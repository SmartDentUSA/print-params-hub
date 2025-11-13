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

    // Fetch enabled categories (visible in navigation)
    const { data: categories, error: categoriesError } = await supabase
      .from('knowledge_categories')
      .select('letter, name, updated_at')
      .eq('enabled', true)
      .order('order_index');

    if (categoriesError) {
      console.error('Error fetching categories:', categoriesError);
      throw categoriesError;
    }

    // Fetch ALL active contents including Category F (hidden but SEO-accessible)
    const { data: contents, error: contentsError } = await supabase
      .from('knowledge_contents')
      .select('slug, updated_at, knowledge_categories!inner(letter)')
      .eq('active', true)
      .order('updated_at', { ascending: false });

    if (contentsError) {
      console.error('Error fetching contents:', contentsError);
      throw contentsError;
    }

    const baseUrl = 'https://smartdent.com.br';
    const now = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

    // Build sitemap XML
    let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  
  <!-- Base de Conhecimento Homepage -->
  <url>
    <loc>${baseUrl}/base-conhecimento</loc>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
    <lastmod>${contents && contents.length > 0 ? new Date(contents[0].updated_at).toISOString().split('T')[0] : now}</lastmod>
  </url>
`;

    // Add category pages
    if (categories && categories.length > 0) {
      for (const category of categories) {
        const lastmod = category.updated_at ? new Date(category.updated_at).toISOString().split('T')[0] : now;
        sitemap += `
  <!-- Category: ${category.name} -->
  <url>
    <loc>${baseUrl}/base-conhecimento/${category.letter.toLowerCase()}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
    <lastmod>${lastmod}</lastmod>
  </url>
`;
      }
    }

    // Add article pages
    if (contents && contents.length > 0) {
      for (const content of contents) {
        const categoryLetter = (content.knowledge_categories as any)?.letter;
        if (!categoryLetter) continue;

        const lastmod = content.updated_at ? new Date(content.updated_at).toISOString().split('T')[0] : now;
        sitemap += `
  <!-- Article: ${content.slug} -->
  <url>
    <loc>${baseUrl}/base-conhecimento/${categoryLetter.toLowerCase()}/${content.slug}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
    <lastmod>${lastmod}</lastmod>
  </url>
`;
      }
    }

    sitemap += `
</urlset>`;

    console.log(`Generated knowledge sitemap with ${categories?.length || 0} categories and ${contents?.length || 0} articles`);

    return new Response(sitemap, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });
  } catch (error) {
    console.error('Error generating knowledge sitemap:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
