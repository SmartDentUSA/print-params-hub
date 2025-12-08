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

    // 4. Buscar dados do produto/resina VINCULADO ao documento
    let linkedProduct = null;
    
    if (documentType === 'catalog' && doc.product_id) {
      console.log('🔗 Buscando produto vinculado:', doc.product_id);
      const { data: product } = await supabase
        .from('system_a_catalog')
        .select('name, category, product_category, product_subcategory')
        .eq('id', doc.product_id)
        .single();
      
      if (product) {
        linkedProduct = {
          name: product.name,
          manufacturer: product.category,
          category: product.product_category,
          subcategory: product.product_subcategory
        };
        console.log('📦 Produto vinculado encontrado:', linkedProduct.name);
      }
    }
    
    if (documentType === 'resin' && doc.resin_id) {
      console.log('🔗 Buscando resina vinculada:', doc.resin_id);
      const { data: resin } = await supabase
        .from('resins')
        .select('name, manufacturer, type')
        .eq('id', doc.resin_id)
        .single();
      
      if (resin) {
        linkedProduct = {
          name: resin.name,
          manufacturer: resin.manufacturer,
          type: resin.type
        };
        console.log('🧪 Resina vinculada encontrada:', linkedProduct.name);
      }
    }

    // 5. Baixar arquivo do storage
    const fileUrl = doc.file_url;
    console.log('📥 Baixando arquivo:', fileUrl);
    
    const fileResponse = await fetch(fileUrl);
    if (!fileResponse.ok) {
      throw new Error('Erro ao baixar arquivo do storage');
    }

    const fileBlob = await fileResponse.blob();
    const fileArrayBuffer = await fileBlob.arrayBuffer();
    const fileBuffer = new Uint8Array(fileArrayBuffer);
    
    // Converter para base64 em chunks para evitar stack overflow
    const CHUNK_SIZE = 8192;
    let binaryString = '';
    for (let i = 0; i < fileBuffer.length; i += CHUNK_SIZE) {
      const chunk = fileBuffer.slice(i, i + CHUNK_SIZE);
      binaryString += String.fromCharCode(...chunk);
    }
    const pdfBase64 = btoa(binaryString);

    console.log(`📊 PDF convertido: ${(pdfBase64.length / 1024).toFixed(1)}KB em base64`);

    // Calcular hash do arquivo
    const hashBuffer = await crypto.subtle.digest('SHA-256', fileArrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const fileHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // 6. Chamar nova edge function de extração PURA
    console.log('🤖 Chamando extract-pdf-raw...');
    
    const extractResponse = await fetch(`${supabaseUrl}/functions/v1/extract-pdf-raw`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        pdfBase64,
        linkedProduct // Passa o produto JÁ VINCULADO
      })
    });

    if (!extractResponse.ok) {
      const errorText = await extractResponse.text();
      throw new Error(`Erro na extração: ${errorText}`);
    }

    const extractData = await extractResponse.json();
    const extractedText = extractData.extractedText;
    
    if (!extractedText) {
      throw new Error('Nenhum texto foi extraído do PDF');
    }

    const tokensUsed = extractData.tokensUsed || Math.ceil(extractedText.length / 4);

    // 7. Salvar no banco
    const { error: updateError } = await supabase
      .from(tableName)
      .update({
        extracted_text: extractedText,
        extracted_at: new Date().toISOString(),
        extraction_method: 'extract-pdf-raw',
        extraction_tokens: tokensUsed,
        extraction_status: 'completed',
        extraction_error: null,
        file_hash: fileHash
      })
      .eq('id', documentId);

    if (updateError) {
      throw updateError;
    }

    console.log('✅ Extração concluída e salva no banco:', documentId);
    if (extractData.hasHallucination) {
      console.warn('⚠️ ALERTA: Possível alucinação detectada na extração');
    }

    return new Response(
      JSON.stringify({
        text: extractedText,
        cached: false,
        extractedAt: new Date().toISOString(),
        method: 'extract-pdf-raw',
        tokens: tokensUsed,
        linkedProduct: linkedProduct?.name || null,
        hasHallucination: extractData.hasHallucination || false
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erro em extract-and-cache-pdf:', error);
    
    // Tentar atualizar status para 'failed'
    try {
      const body = await req.clone().json();
      const { documentId, documentType } = body;
      
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
      console.error('Erro ao atualizar status de falha:', e);
    }

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
