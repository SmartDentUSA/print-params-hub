import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { product_data } = await req.json();
    
    console.log('📦 Iniciando sincronização do Sistema A...');
    
    // Validar que recebeu dados do Sistema A
    if (!product_data?.product_id || !product_data?.basic_info?.name) {
      throw new Error('JSON do Sistema A inválido. Estrutura esperada: { product_id, basic_info: { name, brand } }');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Extrair dados relevantes
    const productId = product_data.product_id;
    const name = product_data.basic_info.name;
    const manufacturer = product_data.basic_info.brand || 'Smart Dent';
    const productUrl = product_data.media_library?.product_url || '';
    const keywords = product_data.seo_data?.primary_keywords || [];
    const description = product_data.marketing_data?.sales_pitch || '';
    
    // Tentar extrair external_id da URL (ID numérico da Loja Integrada)
    const urlMatch = productUrl?.match(/\/(\d+)\//);
    const externalId = urlMatch ? urlMatch[1] : null;

    console.log('📊 Dados extraídos:', {
      productId,
      name: name.substring(0, 50),
      manufacturer,
      externalId,
      hasUrl: !!productUrl
    });

    // Limpar nome da resina (remover "Resina 3D " se existir)
    const cleanName = name.replace(/^Resina 3D /i, '').trim();

    // Upsert na tabela resins
    const { data: resinData, error: resinError } = await supabase
      .from('resins')
      .upsert({
        name: cleanName,
        manufacturer: manufacturer,
        external_id: externalId,
        system_a_product_id: productId,
        system_a_product_url: productUrl,
        keywords: keywords,
        description: description,
        active: true,
        type: 'standard'
      }, {
        onConflict: 'system_a_product_id',
        ignoreDuplicates: false
      })
      .select()
      .single();

    if (resinError) {
      console.error('❌ Erro ao fazer upsert:', resinError);
      throw resinError;
    }

    console.log('✅ Resina sincronizada:', {
      id: resinData.id,
      name: resinData.name,
      system_a_product_id: resinData.system_a_product_id,
      external_id: resinData.external_id
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Resina sincronizada com sucesso',
        resin: {
          id: resinData.id,
          name: resinData.name,
          manufacturer: resinData.manufacturer,
          system_a_product_id: resinData.system_a_product_id,
          external_id: resinData.external_id,
          system_a_product_url: resinData.system_a_product_url
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('❌ Erro na sincronização:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        success: false
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
