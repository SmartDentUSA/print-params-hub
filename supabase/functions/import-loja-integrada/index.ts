import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      status: 200,
      headers: corsHeaders 
    });
  }

  try {
    const { productId, productUrl } = await req.json();
    
    const apiKey = Deno.env.get('LOJA_INTEGRADA_API_KEY');
    const appKey = Deno.env.get('LOJA_INTEGRADA_APP_KEY');
    if (!apiKey) {
      throw new Error('API Key não configurada');
    }
    if (!appKey) {
      console.warn('LOJA_INTEGRADA_APP_KEY ausente - tentando com apenas API Key');
    }

    // Construir endpoint
    let productIdentifier = '';
    
    if (productId) {
      productIdentifier = productId;
    } else if (productUrl) {
      // Extrair slug completo da URL
      const urlParts = productUrl.split('/');
      productIdentifier = urlParts[urlParts.length - 1];
      
      // Remover .html se existir
      if (productIdentifier.endsWith('.html')) {
        productIdentifier = productIdentifier.replace('.html', '');
      }
    } else {
      throw new Error('productId ou productUrl é obrigatório');
    }

    const endpoint = `/produto/${productIdentifier}`;
    
    console.log('🔑 API Key:', apiKey.substring(0, 10) + '...');
    if (appKey) {
      console.log('🔑 App Key:', appKey.substring(0, 10) + '...');
    } else {
      console.log('🔑 App Key: (ausente)');
    }
    console.log('🔗 Slug extraído:', productIdentifier);
    console.log('🌐 URL:', `https://api.awsli.com.br/v1${endpoint}`);

    // Chamar API da Loja Integrada
    const response = await fetch(`https://api.awsli.com.br/v1${endpoint}`, {
      headers: {
        'Authorization': appKey 
          ? `chave_api ${apiKey.trim()} app_key ${appKey.trim()}`
          : `chave_api ${apiKey.trim()}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Supabase-Edge-Function'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText.substring(0, 500)
      });
      throw new Error(`API Error: ${response.status} - ${errorText.substring(0, 200)}`);
    }

    const apiProduct = await response.json();

    // Mapear para estrutura Resin
    const resinData = {
      name: apiProduct.nome || '',
      manufacturer: apiProduct.marca?.nome || apiProduct.fornecedor || '',
      color: '', // Sempre vazio - admin preenche manualmente
      type: 'standard', // Padrão
      description: (apiProduct.descricao_completa || apiProduct.descricao || '').trim(),
      price: parseFloat(apiProduct.preco_promocional || apiProduct.preco_cheio || apiProduct.preco || 0) || 0,
      image_url: apiProduct.imagens?.[0]?.url || '',
      images_gallery: (apiProduct.imagens || []).map((img: any, index: number) => ({
        url: img.url || img.grande || img.media || '',
        alt: apiProduct.nome || 'Resina',
        order: index,
        is_main: index === 0
      }))
    };

    console.log('✅ Produto importado:', {
      name: apiProduct.nome,
      description_length: resinData.description.length,
      price: resinData.price,
      has_image: !!resinData.image_url,
      gallery_count: resinData.images_gallery.length
    });

    return new Response(
      JSON.stringify({ success: true, data: resinData }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Erro na importação:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Erro desconhecido'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
