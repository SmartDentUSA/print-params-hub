import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { documentId, documentType, forceReExtract = false } = await req.json();

    if (!documentId || !documentType) {
      return new Response(
        JSON.stringify({ error: 'documentId e documentType são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const tableName = documentType === 'resin' ? 'resin_documents' : 'catalog_documents';

    // 1. Buscar documento do banco
    const { data: doc, error: fetchError } = await supabase
      .from(tableName)
      .select('*')
      .eq('id', documentId)
      .single();

    if (fetchError || !doc) {
      return new Response(
        JSON.stringify({ error: 'Documento não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Verificar cache (se não forçar re-extração)
    if (!forceReExtract && doc.extracted_text && doc.extraction_status === 'completed') {
      console.log('✅ Cache hit para documento:', documentId);
      return new Response(
        JSON.stringify({
          text: doc.extracted_text,
          cached: true,
          extractedAt: doc.extracted_at,
          method: doc.extraction_method,
          tokens: doc.extraction_tokens
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Cache miss - precisamos extrair
    console.log('⚙️ Cache miss - extraindo documento:', documentId);

    // Atualizar status para 'processing'
    await supabase
      .from(tableName)
      .update({ extraction_status: 'processing' })
      .eq('id', documentId);

    // Baixar arquivo do storage
    const fileUrl = doc.file_url;
    const fileResponse = await fetch(fileUrl);
    if (!fileResponse.ok) {
      throw new Error('Erro ao baixar arquivo do storage');
    }

    const fileBlob = await fileResponse.blob();
    const fileArrayBuffer = await fileBlob.arrayBuffer();
    const fileBuffer = new Uint8Array(fileArrayBuffer);
    
    // Converter para base64 em chunks para evitar stack overflow
    const CHUNK_SIZE = 8192; // 8KB por vez
    let binaryString = '';
    for (let i = 0; i < fileBuffer.length; i += CHUNK_SIZE) {
      const chunk = fileBuffer.slice(i, i + CHUNK_SIZE);
      binaryString += String.fromCharCode(...chunk);
    }
    const pdfBase64 = btoa(binaryString);

    // Calcular hash do arquivo
    const hashBuffer = await crypto.subtle.digest('SHA-256', fileArrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const fileHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Chamar edge function de extração
    const extractResponse = await fetch(`${supabaseUrl}/functions/v1/ai-enrich-pdf-content`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ pdfBase64 })
    });

    if (!extractResponse.ok) {
      const errorText = await extractResponse.text();
      throw new Error(`Erro na extração: ${errorText}`);
    }

    const extractData = await extractResponse.json();
    const extractedText = extractData.enrichedText || extractData.rawText;
    
    if (!extractedText) {
      throw new Error('Nenhum texto foi extraído do PDF');
    }

    // Calcular tokens aproximados (1 token ≈ 4 caracteres)
    const estimatedTokens = Math.ceil(extractedText.length / 4);

    // Salvar no banco
    const { error: updateError } = await supabase
      .from(tableName)
      .update({
        extracted_text: extractedText,
        extracted_at: new Date().toISOString(),
        extraction_method: 'ai-enrich-pdf-content',
        extraction_tokens: estimatedTokens,
        extraction_status: 'completed',
        extraction_error: null,
        file_hash: fileHash
      })
      .eq('id', documentId);

    if (updateError) {
      throw updateError;
    }

    console.log('✅ Extração concluída e salva no banco:', documentId);

    return new Response(
      JSON.stringify({
        text: extractedText,
        cached: false,
        extractedAt: new Date().toISOString(),
        method: 'ai-enrich-pdf-content',
        tokens: estimatedTokens
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro em extract-and-cache-pdf:', error);
    
    // Tentar atualizar status para 'failed' se possível
    try {
      const { documentId, documentType } = await req.json();
      if (documentId && documentType) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);
        const tableName = documentType === 'resin' ? 'resin_documents' : 'catalog_documents';
        
        await supabase
          .from(tableName)
          .update({ 
            extraction_status: 'failed',
            extraction_error: error.message 
          })
          .eq('id', documentId);
      }
    } catch (e) {
      // Ignorar erro ao atualizar status
    }

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
