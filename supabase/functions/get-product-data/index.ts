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
    const url = new URL(req.url);
    const slug = url.searchParams.get('slug');
    const approved = url.searchParams.get('approved') === 'true';

    console.log('🔍 get-product-data invoked:', { slug, approved });

    if (!slug) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Parâmetro slug é obrigatório',
          data: null,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Build query
    let query = supabase
      .from('system_a_catalog')
      .select('*')
      .eq('slug', slug)
      .eq('category', 'product');

    // Apply approved filter if requested
    if (approved) {
      query = query.eq('approved', true);
    }

    const { data, error } = await query.maybeSingle();

    if (error || !data) {
      console.log('⚠️ Produto não encontrado no catálogo, tentando fallback em resins:', { slug, error });

      const { data: resin, error: resinError } = await supabase
        .from('resins')
        .select('*')
        .or(`slug.eq.${slug},name.ilike.%${slug}%`)
        .maybeSingle();

      if (!resin || resinError) {
        console.log('❌ Produto não encontrado em nenhum lugar:', { slug, error, resinError });
        return new Response(
          JSON.stringify({
            success: false,
            message: 'Nenhum produto encontrado',
            data: null,
          }),
          {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // Map resin fallback to expected format
      const fallbackResponse = {
        success: true,
        message: 'Produto encontrado (fallback resins)',
        data: {
          id: resin.id,
          uuid: resin.id,
          external_id: resin.external_id,
          name: resin.name,
          slug: resin.slug || slug,
          description: resin.description,
          image_url: resin.image_url,
          price: resin.price,
          promo_price: null,
          currency: 'BRL',
          url: resin.system_a_product_url || resin.canonical_url || `https://loja.smartdent.com.br/${slug}`,
          canonical_url: resin.canonical_url,
          seo_title_override: resin.seo_title_override,
          seo_description_override: resin.meta_description,
          keywords: resin.keywords || [],
          product_category: null,
          product_subcategory: null,
        },
      };

      return new Response(JSON.stringify(fallbackResponse), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('✅ Produto encontrado:', data.name);

    // Map to expected format
    const response = {
      success: true,
      message: 'Produto encontrado',
      data: {
        id: data.id,
        uuid: data.id,
        external_id: data.external_id,
        name: data.name,
        slug: data.slug,
        description: data.description,
        image_url: data.image_url,
        price: data.price,
        promo_price: data.promo_price,
        currency: data.currency || 'BRL',
        url: data.canonical_url || `https://loja.smartdent.com.br/${data.slug}`,
        canonical_url: data.canonical_url,
        seo_title_override: data.seo_title_override,
        seo_description_override: data.meta_description,
        keywords: data.keywords || [],
        product_category: data.product_category,
        product_subcategory: data.product_subcategory,
      },
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('💥 Erro na edge function:', error);
    return new Response(
      JSON.stringify({
        success: false,
        message: error.message || 'Erro interno do servidor',
        data: null,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
