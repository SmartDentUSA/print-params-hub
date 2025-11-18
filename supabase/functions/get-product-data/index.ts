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
    const rawSlug = url.searchParams.get('slug');
    const approved = url.searchParams.get('approved') === 'true';

    // Normalize slug (support full URLs, trim hyphens/slashes, decode)
    const normalizeSlug = (input: string | null): string | null => {
      if (!input) return null;
      let candidate = input.trim();
      try {
        if (/^https?:\/\//i.test(candidate)) {
          const u = new URL(candidate);
          const segments = u.pathname.split('/').filter(Boolean);
          candidate = segments[segments.length - 1] || candidate;
        }
      } catch {}
      try { candidate = decodeURIComponent(candidate); } catch {}
      candidate = candidate.toLowerCase();
      candidate = candidate.replace(/_/g, '-');
      candidate = candidate.replace(/\s+/g, '-');
      candidate = candidate.replace(/-+/g, '-');
      candidate = candidate.replace(/^[\-/]+|[\-/]+$/g, '');
      return candidate;
    };
    const slug = normalizeSlug(rawSlug);
    const spaceQuery = slug ? slug.replace(/-/g, ' ') : null;
    const tokens = spaceQuery ? spaceQuery.split(/\s+/).filter(t => t.length > 2 && !['resina','resin','modelo','model','smart','print','3d','the','and','for'].includes(t)) : [];
    const longestToken = tokens.sort((a,b)=>b.length-a.length)[0];

    console.log('🔍 get-product-data invoked:', { rawSlug, slug, approved, spaceQuery, longestToken });

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
      console.log('⚠️ Produto não encontrado no catálogo com slug exato, tentando fallbacks:', { slug, error });

      // Enhanced fallback search in system_a_catalog with fuzzy matching
      let catalogProduct: any = null;
      let catalogError: any = null;

      // Catalog Attempt 1: slug ilike
      if (slug) {
        const { data: c1, error: e1 } = await supabase
          .from('system_a_catalog')
          .select('*')
          .eq('category', 'product')
          .ilike('slug', `%${slug}%`)
          .maybeSingle();
        if (c1) {
          catalogProduct = c1;
        } else {
          catalogError = e1 || catalogError;
        }
        console.log('🔎 Fallback attempt 1 (catalog.slug ilike):', { pattern: `%${slug}%`, found: !!c1, error: e1 });
      }

      // Catalog Attempt 2: name ilike with spaces
      if (!catalogProduct && spaceQuery) {
        const { data: c2, error: e2 } = await supabase
          .from('system_a_catalog')
          .select('*')
          .eq('category', 'product')
          .ilike('name', `%${spaceQuery}%`)
          .maybeSingle();
        if (c2) catalogProduct = c2; else catalogError = e2 || catalogError;
        console.log('🔎 Fallback attempt 2 (catalog.name ilike spaceQuery):', { spaceQuery, found: !!c2, error: e2 });
      }

      // Catalog Attempt 3: name ilike longest token
      if (!catalogProduct && longestToken) {
        const { data: c3, error: e3 } = await supabase
          .from('system_a_catalog')
          .select('*')
          .eq('category', 'product')
          .ilike('name', `%${longestToken}%`)
          .maybeSingle();
        if (c3) catalogProduct = c3; else catalogError = e3 || catalogError;
        console.log('🔎 Fallback attempt 3 (catalog.name ilike longestToken):', { longestToken, found: !!c3, error: e3 });
      }

      // If found in catalog with fuzzy matching, return it
      if (catalogProduct) {
        console.log('✅ Produto encontrado via fallback no catálogo:', catalogProduct.name);
        
        const response = {
          success: true,
          message: 'Produto encontrado (fallback catalog)',
          data: {
            id: catalogProduct.id,
            uuid: catalogProduct.id,
            external_id: catalogProduct.external_id,
            name: catalogProduct.name,
            slug: catalogProduct.slug,
            description: catalogProduct.description,
            image_url: catalogProduct.image_url,
            price: catalogProduct.price,
            promo_price: catalogProduct.promo_price,
            currency: catalogProduct.currency || 'BRL',
            url: catalogProduct.canonical_url || `https://loja.smartdent.com.br/${catalogProduct.slug}`,
            canonical_url: catalogProduct.canonical_url,
            seo_title_override: catalogProduct.seo_title_override,
            seo_description_override: catalogProduct.meta_description,
            keywords: catalogProduct.keywords || [],
            product_category: catalogProduct.product_category,
            product_subcategory: catalogProduct.product_subcategory,
          },
        };

        return new Response(JSON.stringify(response), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log('⚠️ Produto não encontrado no catálogo, tentando fallback em resins:', { slug, catalogError });

      // Enhanced fallback search in resins with multiple strategies
      let resin: any = null;
      let resinError: any = null;

      // Attempt 1: exact slug
      if (slug) {
        const { data: r1, error: e1 } = await supabase
          .from('resins')
          .select('*')
          .eq('slug', slug)
          .maybeSingle();
        if (r1) {
          resin = r1;
        } else {
          resinError = e1 || resinError;
        }
        console.log('🔎 Fallback attempt 1 (resins.slug eq):', { slug, found: !!r1, error: e1 });
      }

      // Attempt 2: slug ilike
      if (!resin && slug) {
        const { data: r2, error: e2 } = await supabase
          .from('resins')
          .select('*')
          .ilike('slug', `%${slug}%`)
          .maybeSingle();
        if (r2) resin = r2; else resinError = e2 || resinError;
        console.log('🔎 Fallback attempt 2 (resins.slug ilike):', { pattern: `%${slug}%`, found: !!r2, error: e2 });
      }

      // Attempt 3: name ilike with spaces
      if (!resin && spaceQuery) {
        const { data: r3, error: e3 } = await supabase
          .from('resins')
          .select('*')
          .ilike('name', `%${spaceQuery}%`)
          .maybeSingle();
        if (r3) resin = r3; else resinError = e3 || resinError;
        console.log('🔎 Fallback attempt 3 (resins.name ilike spaceQuery):', { spaceQuery, found: !!r3, error: e3 });
      }

      // Attempt 4: name ilike longest token
      if (!resin && longestToken) {
        const { data: r4, error: e4 } = await supabase
          .from('resins')
          .select('*')
          .ilike('name', `%${longestToken}%`)
          .maybeSingle();
        if (r4) resin = r4; else resinError = e4 || resinError;
        console.log('🔎 Fallback attempt 4 (resins.name ilike longestToken):', { longestToken, found: !!r4, error: e4 });
      }

      if (!resin) {
        console.log('❌ Produto não encontrado em nenhum lugar:', { slug, resinError });
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
