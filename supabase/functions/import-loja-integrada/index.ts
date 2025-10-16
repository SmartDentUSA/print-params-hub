import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { productId, productUrl } = await req.json();
    
    const apiKey = Deno.env.get('LOJA_INTEGRADA_API_KEY');
    if (!apiKey) {
      throw new Error('API Key não configurada');
    }

    // Construir endpoint
    let endpoint = '';
    if (productId) {
      endpoint = `/produto/${productId}`;
    } else if (productUrl) {
      const urlParts = productUrl.split('/');
      const id = urlParts[urlParts.length - 1].split('-')[0];
      endpoint = `/produto/${id}`;
    } else {
      throw new Error('productId ou productUrl é obrigatório');
    }

    console.log('Buscando produto:', endpoint);

    // Chamar API da Loja Integrada
    const response = await fetch(`https://api.awsli.com.br/v1${endpoint}`, {
      headers: {
        'Authorization': `chave_api ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} - ${response.statusText}`);
    }

    const apiProduct = await response.json();

    // Mapear para estrutura Resin
    const resinData = {
      name: apiProduct.nome || '',
      manufacturer: apiProduct.marca?.nome || apiProduct.fornecedor || '',
      color: '', // Sempre vazio - admin preenche manualmente
      type: 'standard', // Padrão
      image_url: apiProduct.imagens?.[0]?.url || '',
      images_gallery: (apiProduct.imagens || []).map((img: any, index: number) => ({
        url: img.url || img.grande || img.media || '',
        alt: apiProduct.nome || 'Resina',
        order: index,
        is_main: index === 0
      }))
    };

    console.log('Produto importado:', apiProduct.nome);

    return new Response(
      JSON.stringify({ success: true, data: resinData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
