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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch all active brands
    const { data: brands, error: brandsError } = await supabase
      .from('brands')
      .select('slug, updated_at')
      .eq('active', true)
      .order('name');

    if (brandsError) {
      console.error('Error fetching brands:', brandsError);
      throw brandsError;
    }

    // Fetch all active models with their brand association
    const { data: models, error: modelsError } = await supabase
      .from('models')
      .select('slug, brand_id, updated_at, brands!inner(slug)')
      .eq('active', true)
      .order('name');

    if (modelsError) {
      console.error('Error fetching models:', modelsError);
      throw modelsError;
    }

    const baseUrl = 'https://parametros.smartdent.com.br';
    const now = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

    // Build sitemap XML
    let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  
  <!-- Homepage -->
  <url>
    <loc>${baseUrl}/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
    <lastmod>${now}</lastmod>
  </url>
`;

    // Add brand pages
    if (brands && brands.length > 0) {
      for (const brand of brands) {
        const lastmod = brand.updated_at ? new Date(brand.updated_at).toISOString().split('T')[0] : now;
        sitemap += `
  <!-- Brand: ${brand.slug} -->
  <url>
    <loc>${baseUrl}?brand=${brand.slug}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
    <lastmod>${lastmod}</lastmod>
  </url>
`;
      }
    }

    // Add model pages
    if (models && models.length > 0) {
      for (const model of models) {
        const brandSlug = (model.brands as any)?.slug;
        if (!brandSlug) continue;

        const lastmod = model.updated_at ? new Date(model.updated_at).toISOString().split('T')[0] : now;
        sitemap += `
  <!-- Model: ${model.slug} -->
  <url>
    <loc>${baseUrl}?brand=${brandSlug}&amp;model=${model.slug}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
    <lastmod>${lastmod}</lastmod>
  </url>
`;
      }
    }

    sitemap += `
</urlset>`;

    console.log(`Generated sitemap with ${brands?.length || 0} brands and ${models?.length || 0} models`);

    return new Response(sitemap, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });
  } catch (error) {
    console.error('Error generating sitemap:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
