import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Tipos que usam extrator especializado
const SPECIALIZED_TYPES = ['guia', 'laudo', 'catalogo', 'ifu', 'fds', 'perfil_tecnico'];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Variáveis salvas para uso no catch (antes de consumir o body)
  let savedDocumentId: string | null = null;
  let savedDocumentType: string | null = null;
  let savedTableName: string | null = null;

  try {
    const { documentId, documentType, forceReExtract = false } = await req.json();
    
    // Salvar para uso no catch
    savedDocumentId = documentId;
    savedDocumentType = documentType;
    savedTableName = documentType === 'resin' ? 'resin_documents' : 'catalog_documents';

    if (!documentId || !documentType) {
      return new Response(
        JSON.stringify({ error: 'documentId e documentType são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const tableName = savedTableName;

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

    const pdfSizeKB = (pdfBase64.length / 1024).toFixed(1);
    console.log(`📊 PDF convertido: ${pdfSizeKB}KB em base64`);

    // Calcular hash do arquivo
    const hashBuffer = await crypto.subtle.digest('SHA-256', fileArrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const fileHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // 6. ROTEAMENTO: Decidir qual extrator usar baseado no document_type do documento
    const docTypeFromDB = doc.document_type;
    const useSpecialized = docTypeFromDB && SPECIALIZED_TYPES.includes(docTypeFromDB);
    
    console.log(`📋 Tipo de documento no banco: ${docTypeFromDB || 'não definido'}`);
    console.log(`🔄 Usando extrator: ${useSpecialized ? 'specialized (' + docTypeFromDB + ')' : 'raw'}`);

    let extractorUrl: string;
    let extractorBody: any;
    let extractionMethod: string;

    if (useSpecialized) {
      // Usar extrator especializado
      extractorUrl = `${supabaseUrl}/functions/v1/extract-pdf-specialized`;
      extractorBody = {
        pdfBase64,
        documentType: docTypeFromDB,
        targetProduct: linkedProduct?.name || null
      };
      extractionMethod = `specialized-${docTypeFromDB}`;
    } else {
      // Fallback para extrator raw (transcrição literal)
      extractorUrl = `${supabaseUrl}/functions/v1/extract-pdf-raw`;
      extractorBody = {
        pdfBase64,
        linkedProduct
      };
      extractionMethod = 'extract-pdf-raw';
    }

    // 7. Chamar edge function de extração com timeout aumentado
    console.log(`🤖 Chamando ${useSpecialized ? 'extract-pdf-specialized' : 'extract-pdf-raw'}...`);
    
    // AbortController com timeout de 180 segundos (3 minutos) para PDFs grandes
    const controller = new AbortController();
    const timeoutMs = 180000; // 3 minutos
    const timeoutId = setTimeout(() => {
      console.warn('⏰ Timeout atingido, abortando requisição...');
      controller.abort();
    }, timeoutMs);
    
    let extractResponse;
    try {
      extractResponse = await fetch(extractorUrl, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(extractorBody)
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!extractResponse.ok) {
      const errorText = await extractResponse.text();
      throw new Error(`Erro na extração: ${errorText}`);
    }

    const extractData = await extractResponse.json();
    const extractedText = extractData.extractedText || extractData.data;
    
    if (!extractedText) {
      throw new Error('Nenhum texto foi extraído do PDF');
    }

    // 8. Verificar resposta do Gatekeeper (apenas para extrator especializado)
    if (useSpecialized) {
      if (extractData.gatekeeperBlock || extractedText.includes('ERRO_TIPO_INCOMPATIVEL')) {
        console.warn('🚫 GATEKEEPER bloqueou a extração');
        
        await supabase
          .from(tableName)
          .update({
            extraction_status: 'failed',
            extraction_error: 'Gatekeeper: Documento incompatível com o tipo selecionado. Verifique se o document_type está correto.',
            extraction_method: 'gatekeeper-blocked'
          })
          .eq('id', documentId);
        
        return new Response(
          JSON.stringify({
            error: 'Documento incompatível com o tipo selecionado',
            gatekeeperMessage: extractedText,
            suggestion: 'Verifique se o tipo de documento está correto ou use outro tipo.'
          }),
          { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (extractData.productNotFound || extractedText.includes('PRODUCT_NOT_FOUND')) {
        console.warn('🔍 Produto não encontrado no documento');
        
        await supabase
          .from(tableName)
          .update({
            extraction_status: 'failed',
            extraction_error: `Produto "${linkedProduct?.name || 'desconhecido'}" não encontrado no documento`,
            extraction_method: 'product-not-found'
          })
          .eq('id', documentId);
        
        return new Response(
          JSON.stringify({
            error: 'Produto não encontrado no documento',
            targetProduct: linkedProduct?.name || null,
            suggestion: 'Verifique se o documento contém informações sobre este produto específico.'
          }),
          { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const tokensUsed = extractData.tokensUsed || Math.ceil(extractedText.length / 4);
    console.log(`📝 Texto extraído: ${extractedText.length} caracteres, ${tokensUsed} tokens`);

    // 9. Salvar no banco
    const { error: updateError } = await supabase
      .from(tableName)
      .update({
        extracted_text: extractedText,
        extracted_at: new Date().toISOString(),
        extraction_method: extractionMethod,
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
        method: extractionMethod,
        tokens: tokensUsed,
        linkedProduct: linkedProduct?.name || null,
        hasHallucination: extractData.hasHallucination || false,
        specializedExtraction: useSpecialized,
        documentType: docTypeFromDB
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erro em extract-and-cache-pdf:', error);
    
    // Atualizar status para 'failed' usando variáveis salvas (sem req.clone())
    if (savedDocumentId && savedTableName) {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);
        
        await supabase
          .from(savedTableName)
          .update({ 
            extraction_status: 'failed',
            extraction_error: error.message || 'Erro desconhecido'
          })
          .eq('id', savedDocumentId);
        
        console.log('📝 Status atualizado para failed:', savedDocumentId);
      } catch (e) {
        console.error('Erro ao atualizar status de falha:', e);
      }
    }

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
