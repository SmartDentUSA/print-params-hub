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
    <loc>${baseUrl}/${brand.slug}</loc>
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
    <loc>${baseUrl}/${brandSlug}/${model.slug}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
    <lastmod>${lastmod}</lastmod>
  </url>
`;
      }
    }

    // Fetch resins (unique combinations)
    const { data: resins, error: resinsError } = await supabase
      .from('parameter_sets')
      .select('brand_slug, model_slug, resin_name, resin_manufacturer')
      .eq('active', true);

    if (resinsError) {
      console.error('Error fetching resins:', resinsError);
    } else if (resins && resins.length > 0) {
      const uniqueResins = [...new Map(resins.map((r: any) => [
        `${r.brand_slug}-${r.model_slug}-${r.resin_manufacturer}-${r.resin_name}`,
        r
      ])).values()];

      for (const resin of uniqueResins) {
        const resinSlug = `${resin.resin_manufacturer}-${resin.resin_name}`
          .toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/[^\w-]/g, '');
        
        sitemap += `
  <!-- Resin: ${resin.resin_name} -->
  <url>
    <loc>${baseUrl}/${resin.brand_slug}/${resin.model_slug}/${resinSlug}</loc>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
    <lastmod>${now}</lastmod>
  </url>
`;
      }
    }

    // Knowledge Base
    const { data: categories } = await supabase
      .from('knowledge_categories')
      .select('id, letter')
      .eq('enabled', true)
      .order('order_index');

    sitemap += `
  <!-- Knowledge Hub -->
  <url>
    <loc>${baseUrl}/base-conhecimento</loc>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
    <lastmod>${now}</lastmod>
  </url>
`;

    if (categories && categories.length > 0) {
      for (const cat of categories) {
        const letter = cat.letter.toLowerCase();
        sitemap += `
  <!-- Knowledge Category: ${cat.letter} -->
  <url>
    <loc>${baseUrl}/base-conhecimento/${letter}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
    <lastmod>${now}</lastmod>
  </url>
`;

        const { data: contents } = await supabase
          .from('knowledge_contents')
          .select('slug, updated_at')
          .eq('category_id', cat.id)
          .eq('active', true);

        if (contents && contents.length > 0) {
          for (const content of contents) {
            const lastmod = content.updated_at 
              ? new Date(content.updated_at).toISOString().split('T')[0] 
              : now;
            
            sitemap += `
  <!-- Article: ${content.slug} -->
  <url>
    <loc>${baseUrl}/base-conhecimento/${letter}/${content.slug}</loc>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
    <lastmod>${lastmod}</lastmod>
  </url>
`;
          }
        }
      }
    }

    // Sistema A - Produtos Comerciais
    const { data: products } = await supabase
      .from('system_a_catalog')
      .select('slug, updated_at, name')
      .eq('category', 'product')
      .eq('active', true)
      .eq('approved', true)
      .order('name');

    if (products && products.length > 0) {
      for (const product of products) {
        // Extract slug from URL if it's a complete URL
        let productSlug = product.slug;
        if (productSlug && productSlug.includes('http')) {
          try {
            productSlug = new URL(productSlug).pathname.split('/').pop() || productSlug;
          } catch (e) {
            console.warn(`Invalid URL in product slug: ${productSlug}`);
          }
        }
        
        const lastmod = product.updated_at 
          ? new Date(product.updated_at).toISOString().split('T')[0] 
          : now;
        
        sitemap += `
  <!-- Produto: ${product.name} -->
  <url>
    <loc>${baseUrl}/produtos/${productSlug}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
    <lastmod>${lastmod}</lastmod>
  </url>
`;
      }
    }

    // Sistema A - Depoimentos em Vídeo (limitar aos 50 mais recentes)
    const { data: videos } = await supabase
      .from('system_a_catalog')
      .select('slug, updated_at, name')
      .eq('category', 'video_testimonial')
      .eq('active', true)
      .eq('approved', true)
      .order('updated_at', { ascending: false })
      .limit(50);

    if (videos && videos.length > 0) {
      for (const video of videos) {
        // Extract slug from URL if it's a complete URL
        let videoSlug = video.slug;
        if (videoSlug && videoSlug.includes('http')) {
          try {
            videoSlug = new URL(videoSlug).pathname.split('/').pop() || videoSlug;
          } catch (e) {
            console.warn(`Invalid URL in testimonial slug: ${videoSlug}`);
          }
        }
        
        const lastmod = video.updated_at 
          ? new Date(video.updated_at).toISOString().split('T')[0] 
          : now;
        
        sitemap += `
  <!-- Depoimento: ${video.name} -->
  <url>
    <loc>${baseUrl}/depoimentos/${videoSlug}</loc>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
    <lastmod>${lastmod}</lastmod>
  </url>
`;
      }
    }

    // Sistema A - Configurações de Categoria
    const { data: configs } = await supabase
      .from('system_a_catalog')
      .select('slug, updated_at, name')
      .eq('category', 'category_config')
      .eq('active', true)
      .eq('approved', true);

    if (configs && configs.length > 0) {
      for (const config of configs) {
        const lastmod = config.updated_at 
          ? new Date(config.updated_at).toISOString().split('T')[0] 
          : now;
        
        sitemap += `
  <!-- Configuração: ${config.name} -->
  <url>
    <loc>${baseUrl}/categorias/${config.slug}</loc>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
    <lastmod>${lastmod}</lastmod>
  </url>
`;
      }
    }

    // 🆕 Documentos Técnicos (PDFs)
    const { data: documents } = await supabase
      .from('resin_documents')
      .select('file_url, updated_at, document_name')
      .eq('active', true)
      .order('updated_at', { ascending: false })
      .limit(100); // Limitar para não sobrecarregar

    if (documents && documents.length > 0) {
      for (const doc of documents) {
        const lastmod = doc.updated_at 
          ? new Date(doc.updated_at).toISOString().split('T')[0] 
          : now;
        
        sitemap += `
  <!-- Documento Técnico: ${doc.document_name} -->
  <url>
    <loc>${doc.file_url}</loc>
    <changefreq>monthly</changefreq>
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
