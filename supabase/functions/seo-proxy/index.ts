import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const isBot = (ua: string): boolean =>
  /(googlebot|bingbot|slurp|duckduckbot|baiduspider|yandexbot|facebookexternalhit|twitterbot|linkedinbot|whatsapp)/i.test(ua);

function generate404(): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <title>Página não encontrada | Smart Dent</title>
  <meta name="robots" content="noindex" />
</head>
<body>
  <h1>404 - Página não encontrada</h1>
  <p>A página solicitada não existe.</p>
  <a href="/">Voltar para o início</a>
</body>
</html>`;
}

async function generateHomepageHTML(supabase: any): Promise<string> {
  const { data: brands } = await supabase
    .from('brands')
    .select('name, slug, logo_url')
    .eq('active', true)
    .order('name')
    .limit(20);

  const baseUrl = 'https://parametros.smartdent.com.br';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <title>Parâmetros de Impressão 3D Odontológica | Smart Dent</title>
  <meta name="description" content="Base de dados profissional com parâmetros testados para ${brands?.length || 15}+ marcas de impressoras 3D odontológicas. Elegoo, Anycubic, Creality e mais." />
  <link rel="canonical" href="${baseUrl}/" />
  <meta property="og:title" content="Parâmetros de Impressão 3D Odontológica" />
  <meta property="og:description" content="Configurações profissionais para impressoras e resinas 3D odontológicas" />
  <meta property="og:image" content="${baseUrl}/og-image.jpg" />
  <meta property="og:type" content="website" />
  <script type="application/ld+json">
  ${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "Smart Dent - Parâmetros de Impressão 3D",
    "url": baseUrl,
    "description": "Base de dados profissional com parâmetros testados",
    "potentialAction": {
      "@type": "SearchAction",
      "target": `${baseUrl}/?search={search_term_string}`,
      "query-input": "required name=search_term_string"
    }
  })}
  </script>
</head>
<body>
  <h1>Parâmetros de Impressão 3D Odontológica</h1>
  <p>Base de dados profissional com parâmetros testados para impressoras e resinas Smart Dent.</p>
  <h2>Marcas Disponíveis</h2>
  <ul>
    ${brands?.map((b: any) => `<li><a href="/${b.slug}">${b.name}</a></li>`).join('') || ''}
  </ul>
  <script>window.location.href="/"</script>
</body>
</html>`;
}

async function generateBrandHTML(brandSlug: string, supabase: any): Promise<string> {
  const { data: brand } = await supabase
    .from('brands')
    .select('*, models(name, slug, image_url)')
    .eq('slug', brandSlug)
    .eq('active', true)
    .single();

  if (!brand) return '';

  const modelsCount = brand.models?.length || 0;
  const baseUrl = 'https://parametros.smartdent.com.br';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <title>${brand.name} - Parâmetros de Impressão 3D | Smart Dent</title>
  <meta name="description" content="Configurações profissionais para impressoras 3D ${brand.name}. ${modelsCount} modelos disponíveis com parâmetros testados." />
  <link rel="canonical" href="${baseUrl}/${brandSlug}" />
  <meta property="og:title" content="${brand.name} - Parâmetros de Impressão 3D" />
  <meta property="og:description" content="Configurações para ${modelsCount} modelos ${brand.name}" />
  <meta property="og:image" content="${brand.logo_url || `${baseUrl}/og-image.jpg`}" />
  <script type="application/ld+json">
  ${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": brand.name,
    "url": `${baseUrl}/${brandSlug}`,
    "logo": brand.logo_url
  })}
  </script>
</head>
<body>
  <h1>Impressoras 3D ${brand.name}</h1>
  <p>Parâmetros profissionais testados para impressoras 3D ${brand.name}.</p>
  <h2>Modelos Disponíveis (${modelsCount})</h2>
  <ul>
    ${brand.models?.map((m: any) => `<li><a href="/${brandSlug}/${m.slug}">${m.name}</a></li>`).join('') || ''}
  </ul>
  <script>window.location.href="/${brandSlug}"</script>
</body>
</html>`;
}

async function generateModelHTML(brandSlug: string, modelSlug: string, supabase: any): Promise<string> {
  const { data: model } = await supabase
    .from('models')
    .select('*, brands!inner(*)')
    .eq('slug', modelSlug)
    .eq('brands.slug', brandSlug)
    .eq('active', true)
    .single();

  if (!model) return '';

  const { data: resins } = await supabase
    .from('parameter_sets')
    .select('resin_name, resin_manufacturer')
    .eq('brand_slug', brandSlug)
    .eq('model_slug', modelSlug)
    .eq('active', true);

  const uniqueResins = [...new Map(resins?.map((r: any) => 
    [`${r.resin_manufacturer}-${r.resin_name}`, r]
  )).values()];

  const resinsCount = uniqueResins.length;
  const baseUrl = 'https://parametros.smartdent.com.br';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <title>${model.name} - Parâmetros de Impressão 3D | Smart Dent</title>
  <meta name="description" content="Parâmetros profissionais para ${model.name}. ${resinsCount} resinas disponíveis com configurações testadas." />
  <link rel="canonical" href="${baseUrl}/${brandSlug}/${modelSlug}" />
  <meta property="og:title" content="${model.name} - Parâmetros de Impressão" />
  <meta property="og:description" content="${resinsCount} resinas disponíveis para ${model.name}" />
  <meta property="og:image" content="${model.image_url || `${baseUrl}/og-image.jpg`}" />
  <script type="application/ld+json">
  ${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Product",
    "name": model.name,
    "description": model.notes || `Impressora 3D ${model.name}`,
    "brand": {
      "@type": "Brand",
      "name": (model.brands as any).name
    },
    "image": model.image_url,
    "url": `${baseUrl}/${brandSlug}/${modelSlug}`
  })}
  </script>
</head>
<body>
  <h1>${model.name}</h1>
  <p>Parâmetros profissionais testados para ${model.name}.</p>
  ${model.notes ? `<p>${model.notes}</p>` : ''}
  <h2>Resinas Disponíveis (${resinsCount})</h2>
  <ul>
    ${uniqueResins.map((r: any) => {
      const resinSlug = `${r.resin_manufacturer}-${r.resin_name}`.toLowerCase().replace(/\s+/g, '-');
      return `<li><a href="/${brandSlug}/${modelSlug}/${resinSlug}">${r.resin_name}</a></li>`;
    }).join('') || ''}
  </ul>
  <script>window.location.href="/${brandSlug}/${modelSlug}"</script>
</body>
</html>`;
}

async function generateResinHTML(brandSlug: string, modelSlug: string, resinSlug: string, supabase: any): Promise<string> {
  const { data: params } = await supabase
    .from('parameter_sets')
    .select('*')
    .eq('brand_slug', brandSlug)
    .eq('model_slug', modelSlug)
    .eq('active', true)
    .limit(100);

  if (!params || params.length === 0) return '';

  const resinData = params.find((p: any) => {
    const slug = `${p.resin_manufacturer}-${p.resin_name}`.toLowerCase().replace(/\s+/g, '-');
    return slug === resinSlug || slug.includes(resinSlug) || resinSlug.includes(slug);
  }) || params[0];

  const baseUrl = 'https://parametros.smartdent.com.br';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <title>${resinData.resin_name} para ${modelSlug} - Parâmetros | Smart Dent</title>
  <meta name="description" content="Parâmetros profissionais testados: ${resinData.resin_name}. Layer: ${resinData.layer_height}mm, Cure: ${resinData.cure_time}s, Luz: ${resinData.light_intensity}%." />
  <link rel="canonical" href="${baseUrl}/${brandSlug}/${modelSlug}/${resinSlug}" />
  <meta property="og:title" content="${resinData.resin_name} - Parâmetros de Impressão" />
  <meta property="og:description" content="Configurações testadas para impressora ${modelSlug}" />
  <meta property="og:image" content="${baseUrl}/og-image.jpg" />
  <script type="application/ld+json">
  ${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Product",
    "name": resinData.resin_name,
    "description": `Resina ${resinData.resin_name} com parâmetros otimizados`,
    "brand": {
      "@type": "Brand",
      "name": resinData.resin_manufacturer
    },
    "offers": {
      "@type": "Offer",
      "availability": "https://schema.org/InStock",
      "url": `${baseUrl}/${brandSlug}/${modelSlug}/${resinSlug}`
    },
    "additionalProperty": [
      { "@type": "PropertyValue", "name": "Layer Height", "value": `${resinData.layer_height}mm` },
      { "@type": "PropertyValue", "name": "Cure Time", "value": `${resinData.cure_time}s` },
      { "@type": "PropertyValue", "name": "Light Intensity", "value": `${resinData.light_intensity}%` }
    ]
  })}
  </script>
</head>
<body>
  <h1>${resinData.resin_name}</h1>
  <p>Parâmetros profissionais testados para ${resinData.resin_name} na impressora ${modelSlug}.</p>
  <h2>Parâmetros de Impressão</h2>
  <ul>
    <li><strong>Layer Height:</strong> ${resinData.layer_height}mm</li>
    <li><strong>Cure Time:</strong> ${resinData.cure_time}s</li>
    <li><strong>Bottom Cure Time:</strong> ${resinData.bottom_cure_time || 'N/A'}s</li>
    <li><strong>Light Intensity:</strong> ${resinData.light_intensity}%</li>
    <li><strong>Bottom Layers:</strong> ${resinData.bottom_layers || 5}</li>
    <li><strong>Lift Distance:</strong> ${resinData.lift_distance || 5}mm</li>
    <li><strong>Lift Speed:</strong> ${resinData.lift_speed || 3}mm/s</li>
  </ul>
  ${resinData.notes ? `<p><strong>Observações:</strong> ${resinData.notes}</p>` : ''}
  <script>window.location.href="/${brandSlug}/${modelSlug}/${resinSlug}"</script>
</body>
</html>`;
}

async function generateKnowledgeHubHTML(supabase: any): Promise<string> {
  const { data: categories } = await supabase
    .from('knowledge_categories')
    .select('*, knowledge_contents(count)')
    .eq('enabled', true)
    .order('order_index');

  const baseUrl = 'https://parametros.smartdent.com.br';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <title>Base de Conhecimento | Smart Dent</title>
  <meta name="description" content="Artigos, tutoriais e guias sobre impressão 3D odontológica. Aprenda técnicas, resolução de problemas e melhores práticas." />
  <link rel="canonical" href="${baseUrl}/base-conhecimento" />
  <meta property="og:title" content="Base de Conhecimento Smart Dent" />
  <meta property="og:type" content="website" />
  <script type="application/ld+json">
  ${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "Base de Conhecimento Smart Dent",
    "url": `${baseUrl}/base-conhecimento`,
    "description": "Artigos e tutoriais sobre impressão 3D odontológica"
  })}
  </script>
</head>
<body>
  <h1>Base de Conhecimento</h1>
  <p>Artigos, tutoriais e guias sobre impressão 3D odontológica.</p>
  <h2>Categorias</h2>
  <ul>
    ${categories?.map((c: any) => `<li><a href="/base-conhecimento/${c.letter.toLowerCase()}">${c.letter} - ${c.name}</a></li>`).join('') || ''}
  </ul>
  <script>window.location.href="/base-conhecimento"</script>
</body>
</html>`;
}

async function generateKnowledgeCategoryHTML(letter: string, supabase: any): Promise<string> {
  const { data: category } = await supabase
    .from('knowledge_categories')
    .select('*')
    .eq('letter', letter.toUpperCase())
    .eq('enabled', true)
    .single();

  if (!category) return '';

  const { data: contents } = await supabase
    .from('knowledge_contents')
    .select('title, slug, excerpt')
    .eq('category_id', category.id)
    .eq('active', true)
    .order('order_index')
    .limit(50);

  const baseUrl = 'https://parametros.smartdent.com.br';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <title>${category.letter} - ${category.name} | Base de Conhecimento</title>
  <meta name="description" content="Artigos sobre ${category.name}. ${contents?.length || 0} conteúdos disponíveis." />
  <link rel="canonical" href="${baseUrl}/base-conhecimento/${letter.toLowerCase()}" />
  <meta property="og:title" content="${category.name}" />
</head>
<body>
  <h1>${category.letter} - ${category.name}</h1>
  <p>${contents?.length || 0} artigos disponíveis nesta categoria.</p>
  <ul>
    ${contents?.map((c: any) => `<li><a href="/base-conhecimento/${letter.toLowerCase()}/${c.slug}">${c.title}</a></li>`).join('') || ''}
  </ul>
  <script>window.location.href="/base-conhecimento/${letter.toLowerCase()}"</script>
</body>
</html>`;
}

async function generateKnowledgeArticleHTML(letter: string, slug: string, supabase: any): Promise<string> {
  const { data: content } = await supabase
    .from('knowledge_contents')
    .select('*, knowledge_categories(*), authors(*)')
    .eq('slug', slug)
    .eq('active', true)
    .single();

  if (!content) return '';

  const desc = content.meta_description || content.excerpt || 
    (content.content_html?.replace(/<[^>]*>/g, '').substring(0, 160) + '...');

  const baseUrl = 'https://parametros.smartdent.com.br';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <title>${content.title} | Base de Conhecimento Smart Dent</title>
  <meta name="description" content="${desc}" />
  <link rel="canonical" href="${baseUrl}/base-conhecimento/${letter}/${slug}" />
  <meta property="og:title" content="${content.title}" />
  <meta property="og:description" content="${content.excerpt || desc}" />
  <meta property="og:image" content="${content.og_image_url || `${baseUrl}/og-image.jpg`}" />
  <meta property="og:type" content="article" />
  ${content.keywords ? `<meta name="keywords" content="${content.keywords.join(', ')}" />` : ''}
  <script type="application/ld+json">
  ${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": content.title,
    "description": content.excerpt || desc,
    "image": content.og_image_url,
    "datePublished": content.created_at,
    "dateModified": content.updated_at,
    "author": content.authors ? {
      "@type": "Person",
      "name": content.authors.name,
      "url": content.authors.website_url
    } : undefined
  })}
  </script>
</head>
<body>
  <article>
    <h1>${content.title}</h1>
    <p>${content.excerpt}</p>
    ${content.content_html || ''}
  </article>
  <script>window.location.href="/base-conhecimento/${letter}/${slug}"</script>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const userAgent = req.headers.get('User-Agent') || '';
  
  if (!isBot(userAgent)) {
    return new Response('', { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'text/html' } 
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const url = new URL(req.url);
  const path = url.pathname;
  const segments = path.split('/').filter(Boolean);

  console.log('SEO Proxy:', { path, segments, userAgent });

  let html = '';

  try {
    if (segments[0] === 'base-conhecimento') {
      if (segments.length === 1) {
        html = await generateKnowledgeHubHTML(supabase);
      } else if (segments.length === 2) {
        html = await generateKnowledgeCategoryHTML(segments[1], supabase);
      } else if (segments.length === 3) {
        html = await generateKnowledgeArticleHTML(segments[1], segments[2], supabase);
      }
    } else if (segments.length === 0) {
      html = await generateHomepageHTML(supabase);
    } else if (segments.length === 1) {
      html = await generateBrandHTML(segments[0], supabase);
    } else if (segments.length === 2) {
      html = await generateModelHTML(segments[0], segments[1], supabase);
    } else if (segments.length === 3) {
      html = await generateResinHTML(segments[0], segments[1], segments[2], supabase);
    }

    if (!html) {
      html = generate404();
    }

    return new Response(html, {
      status: html === generate404() ? 404 : 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    });
  } catch (error) {
    console.error('Error generating HTML:', error);
    return new Response(generate404(), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'text/html' },
    });
  }
});
