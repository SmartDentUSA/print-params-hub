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

// FASE 2: Sanitização HTML
function escapeHtml(text: string | undefined | null): string {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/\r?\n/g, ' ')
    .trim();
}

// FASE 4: Normalização de slugs
function normalizeSlug(text: string): string {
  return (text || '')
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[^\w\s-]/g, '') // Remove caracteres especiais
    .replace(/\s+/g, '-') // Espaços → hífens
    .replace(/-+/g, '-') // Remove hífens duplicados
    .replace(/^-|-$/g, ''); // Remove hífens nas pontas
}

async function generateHomepageHTML(supabase: any): Promise<string> {
  const { data: brands, error } = await supabase
    .from('brands')
    .select('name, slug, logo_url')
    .eq('active', true)
    .order('name')
    .limit(20);

  if (error) {
    console.error('Supabase error fetching brands:', error.message);
    return '';
  }

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
  <script>
  (function() {
    var ua = navigator.userAgent.toLowerCase();
    var isBot = /bot|crawler|spider|googlebot|bingbot|slurp|facebook|twitter|whatsapp/i.test(ua);
    if (!isBot && !navigator.webdriver) {
      window.location.href = "/";
    }
  })();
  </script>
</body>
</html>`;
}

async function generateBrandHTML(brandSlug: string, supabase: any): Promise<string> {
  const { data: brand, error } = await supabase
    .from('brands')
    .select('*, models(name, slug, image_url)')
    .eq('slug', brandSlug)
    .eq('active', true)
    .single();

  if (error) {
    console.error('Supabase error fetching brand:', brandSlug, error.message);
    return '';
  }

  if (!brand) {
    console.log('Brand not found:', brandSlug);
    return '';
  }

  const modelsCount = brand.models?.length || 0;
  const baseUrl = 'https://parametros.smartdent.com.br';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <title>${escapeHtml(brand.name)} - Parâmetros de Impressão 3D | Smart Dent</title>
  <meta name="description" content="Configurações profissionais para impressoras 3D ${escapeHtml(brand.name)}. ${modelsCount} modelos disponíveis com parâmetros testados." />
  <link rel="canonical" href="${baseUrl}/${brandSlug}" />
  <meta property="og:title" content="${escapeHtml(brand.name)} - Parâmetros de Impressão 3D" />
  <meta property="og:description" content="Configurações para ${modelsCount} modelos ${escapeHtml(brand.name)}" />
  <meta property="og:image" content="${brand.logo_url || `${baseUrl}/og-image.jpg`}" />
  <script type="application/ld+json">
  ${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": escapeHtml(brand.name),
    "url": `${baseUrl}/${brandSlug}`,
    "logo": brand.logo_url
  })}
  </script>
  <script type="application/ld+json">
  ${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Início", "item": baseUrl },
      { "@type": "ListItem", "position": 2, "name": escapeHtml(brand.name), "item": `${baseUrl}/${brandSlug}` }
    ]
  })}
  </script>
</head>
<body>
  <h1>Impressoras 3D ${escapeHtml(brand.name)}</h1>
  <p>Parâmetros profissionais testados para impressoras 3D ${escapeHtml(brand.name)}.</p>
  <h2>Modelos Disponíveis (${modelsCount})</h2>
  <ul>
    ${brand.models?.map((m: any) => `<li><a href="/${brandSlug}/${m.slug}">${m.name}</a></li>`).join('') || ''}
  </ul>
  <script>
  (function() {
    var ua = navigator.userAgent.toLowerCase();
    var isBot = /bot|crawler|spider|googlebot|bingbot|slurp|facebook|twitter|whatsapp/i.test(ua);
    if (!isBot && !navigator.webdriver) {
      window.location.href = "/${brandSlug}";
    }
  })();
  </script>
</body>
</html>`;
}

async function generateModelHTML(brandSlug: string, modelSlug: string, supabase: any): Promise<string> {
  const { data: model, error: modelError } = await supabase
    .from('models')
    .select('*, brands!inner(*)')
    .eq('slug', modelSlug)
    .eq('brands.slug', brandSlug)
    .eq('active', true)
    .single();

  if (modelError) {
    console.error('Supabase error fetching model:', modelSlug, modelError.message);
    return '';
  }

  if (!model) {
    console.log('Model not found:', modelSlug);
    return '';
  }

  const { data: resins, error: resinsError } = await supabase
    .from('parameter_sets')
    .select('resin_name, resin_manufacturer')
    .eq('brand_slug', brandSlug)
    .eq('model_slug', modelSlug)
    .eq('active', true);

  if (resinsError) {
    console.error('Supabase error fetching resins:', resinsError.message);
  }

  const uniqueResins = [...new Map(resins?.map((r: any) => 
    [`${r.resin_manufacturer}-${r.resin_name}`, r]
  )).values()];

  const resinsCount = uniqueResins.length;
  const baseUrl = 'https://parametros.smartdent.com.br';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <title>${escapeHtml(model.name)} - Parâmetros de Impressão 3D | Smart Dent</title>
  <meta name="description" content="Parâmetros profissionais para ${escapeHtml(model.name)}. ${resinsCount} resinas disponíveis com configurações testadas." />
  <link rel="canonical" href="${baseUrl}/${brandSlug}/${modelSlug}" />
  <meta property="og:title" content="${escapeHtml(model.name)} - Parâmetros de Impressão" />
  <meta property="og:description" content="${resinsCount} resinas disponíveis para ${escapeHtml(model.name)}" />
  <meta property="og:image" content="${model.image_url || `${baseUrl}/og-image.jpg`}" />
  <script type="application/ld+json">
  ${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Product",
    "name": escapeHtml(model.name),
    "description": escapeHtml(model.notes) || `Impressora 3D ${escapeHtml(model.name)}`,
    "brand": {
      "@type": "Brand",
      "name": escapeHtml((model.brands as any).name)
    },
    "image": model.image_url,
    "url": `${baseUrl}/${brandSlug}/${modelSlug}`
  })}
  </script>
  <script type="application/ld+json">
  ${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Início", "item": baseUrl },
      { "@type": "ListItem", "position": 2, "name": escapeHtml((model.brands as any).name), "item": `${baseUrl}/${brandSlug}` },
      { "@type": "ListItem", "position": 3, "name": escapeHtml(model.name), "item": `${baseUrl}/${brandSlug}/${modelSlug}` }
    ]
  })}
  </script>
</head>
<body>
  <h1>${escapeHtml(model.name)}</h1>
  <p>Parâmetros profissionais testados para ${escapeHtml(model.name)}.</p>
  ${model.notes ? `<p>${escapeHtml(model.notes)}</p>` : ''}
  <h2>Resinas Disponíveis (${resinsCount})</h2>
  <ul>
    ${uniqueResins.map((r: any) => {
      const resinSlug = `${r.resin_manufacturer}-${r.resin_name}`.toLowerCase().replace(/\s+/g, '-');
      return `<li><a href="/${brandSlug}/${modelSlug}/${resinSlug}">${r.resin_name}</a></li>`;
    }).join('') || ''}
  </ul>
  <script>
  (function() {
    var ua = navigator.userAgent.toLowerCase();
    var isBot = /bot|crawler|spider|googlebot|bingbot|slurp|facebook|twitter|whatsapp/i.test(ua);
    if (!isBot && !navigator.webdriver) {
      window.location.href = "/${brandSlug}/${modelSlug}";
    }
  })();
  </script>
</body>
</html>`;
}

async function generateResinHTML(brandSlug: string, modelSlug: string, resinSlug: string, supabase: any): Promise<string> {
  // Buscar dados da resina com JOIN em parameter_sets para obter parâmetros técnicos
  const { data: resinWithParams, error } = await supabase
    .from('resins')
    .select(`
      *,
      parameter_sets!inner(
        layer_height,
        cure_time,
        bottom_cure_time,
        light_intensity,
        bottom_layers,
        lift_distance,
        lift_speed,
        notes
      )
    `)
    .eq('parameter_sets.brand_slug', brandSlug)
    .eq('parameter_sets.model_slug', modelSlug)
    .eq('parameter_sets.active', true)
    .eq('active', true)
    .limit(100);

  if (error) {
    console.error('Supabase error fetching resin data:', error.message);
    return '';
  }

  if (!resinWithParams || resinWithParams.length === 0) {
    console.log('No resin found for:', brandSlug, modelSlug, resinSlug);
    return '';
  }

  // FASE 4: Matching robusto de slugs
  const resinData = resinWithParams.find((r: any) => {
    const dbSlug = r.slug ? normalizeSlug(r.slug) : normalizeSlug(`${r.manufacturer}-${r.name}`);
    const requestSlug = normalizeSlug(resinSlug);
    return dbSlug === requestSlug;
  }) || resinWithParams[0];

  // Pegar primeiro parameter_set (pode ter múltiplos, mas usamos o primeiro)
  const params = Array.isArray(resinData.parameter_sets) ? resinData.parameter_sets[0] : resinData.parameter_sets;

  const baseUrl = 'https://parametros.smartdent.com.br';
  
  // Usar campos SEO da tabela resins
  const seoTitle = resinData.seo_title_override || `${escapeHtml(resinData.name)} para ${escapeHtml(modelSlug)} - Parâmetros | Smart Dent`;
  const metaDescription = resinData.meta_description || `Parâmetros profissionais testados: ${escapeHtml(resinData.name)}. Layer: ${params.layer_height}mm, Cure: ${params.cure_time}s, Luz: ${params.light_intensity}%.`;
  const canonicalUrl = resinData.canonical_url || `${baseUrl}/${brandSlug}/${modelSlug}/${resinSlug}`;
  const ogImage = resinData.og_image_url || resinData.image_url || `${baseUrl}/og-image.jpg`;
  const keywords = resinData.keywords || [];

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <title>${seoTitle}</title>
  <meta name="description" content="${metaDescription}" />
  ${keywords.length > 0 ? `<meta name="keywords" content="${keywords.map(escapeHtml).join(', ')}" />` : ''}
  <link rel="canonical" href="${canonicalUrl}" />
  <meta property="og:title" content="${escapeHtml(resinData.name)} - Parâmetros de Impressão" />
  <meta property="og:description" content="${metaDescription}" />
  <meta property="og:image" content="${ogImage}" />
  <meta property="og:type" content="product" />
  <script type="application/ld+json">
  ${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Smart Dent",
    "url": baseUrl,
    "logo": `${baseUrl}/og-image.jpg`,
    "description": "Parâmetros profissionais para impressão 3D odontológica"
  })}
  </script>
  <script type="application/ld+json">
  ${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Product",
    "name": escapeHtml(resinData.name),
    "description": resinData.description || `Resina ${escapeHtml(resinData.name)} com parâmetros otimizados`,
    "brand": {
      "@type": "Brand",
      "name": escapeHtml(resinData.manufacturer)
    },
    "image": ogImage,
    "offers": {
      "@type": "Offer",
      "availability": "https://schema.org/InStock",
      "url": canonicalUrl,
      "price": resinData.price || undefined,
      "priceCurrency": resinData.price ? "BRL" : undefined
    },
    "additionalProperty": [
      { "@type": "PropertyValue", "name": "Layer Height", "value": `${params.layer_height}mm` },
      { "@type": "PropertyValue", "name": "Cure Time", "value": `${params.cure_time}s` },
      { "@type": "PropertyValue", "name": "Light Intensity", "value": `${params.light_intensity}%` }
    ]
  })}
  </script>
  <script type="application/ld+json">
  ${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Início", "item": baseUrl },
      { "@type": "ListItem", "position": 2, "name": escapeHtml(brandSlug), "item": `${baseUrl}/${brandSlug}` },
      { "@type": "ListItem", "position": 3, "name": escapeHtml(modelSlug), "item": `${baseUrl}/${brandSlug}/${modelSlug}` },
      { "@type": "ListItem", "position": 4, "name": `${escapeHtml(resinData.manufacturer)} ${escapeHtml(resinData.name)}`, "item": canonicalUrl }
    ]
  })}
  </script>
</head>
<body>
  <h1>${escapeHtml(resinData.name)}</h1>
  <p>${resinData.description || `Parâmetros profissionais testados para ${escapeHtml(resinData.name)} na impressora ${escapeHtml(modelSlug)}.`}</p>
  <h2>Parâmetros de Impressão</h2>
  <ul>
    <li><strong>Layer Height:</strong> ${params.layer_height}mm</li>
    <li><strong>Cure Time:</strong> ${params.cure_time}s</li>
    <li><strong>Bottom Cure Time:</strong> ${params.bottom_cure_time || 'N/A'}s</li>
    <li><strong>Light Intensity:</strong> ${params.light_intensity}%</li>
    <li><strong>Bottom Layers:</strong> ${params.bottom_layers || 5}</li>
    <li><strong>Lift Distance:</strong> ${params.lift_distance || 5}mm</li>
    <li><strong>Lift Speed:</strong> ${params.lift_speed || 3}mm/s</li>
  </ul>
  ${params.notes ? `<p><strong>Observações:</strong> ${escapeHtml(params.notes)}</p>` : ''}
  ${resinData.cta_1_url ? `<p><a href="${escapeHtml(resinData.cta_1_url)}" target="_blank">${escapeHtml(resinData.cta_1_label || 'Saiba mais')}</a></p>` : ''}
  <script>
  (function() {
    var ua = navigator.userAgent.toLowerCase();
    var isBot = /bot|crawler|spider|googlebot|bingbot|slurp|facebook|twitter|whatsapp/i.test(ua);
    if (!isBot && !navigator.webdriver) {
      window.location.href = "/${brandSlug}/${modelSlug}/${resinSlug}";
    }
  })();
  </script>
</body>
</html>`;
}

async function generateSystemACatalogHTML(
  category: string, 
  slug: string, 
  supabase: any
): Promise<string> {
  const { data: item, error } = await supabase
    .from('system_a_catalog')
    .select('*')
    .eq('category', category)
    .eq('slug', slug)
    .eq('active', true)
    .eq('approved', true)
    .maybeSingle();

  if (error || !item) return generate404();

  const baseUrl = 'https://parametros.smartdent.com.br';
  const seoTitle = item.seo_title_override || `${item.name} | Smart Dent`;
  const metaDescription = item.meta_description || item.description || '';
  const categoryPath = category === 'product' ? 'produtos' : 
                       category === 'video_testimonial' ? 'depoimentos' : 'categorias';
  const canonicalUrl = item.canonical_url || `${baseUrl}/${categoryPath}/${slug}`;
  const ogImage = item.og_image_url || item.image_url || `${baseUrl}/og-image.jpg`;
  const keywords = item.keywords || [];

  const extraData = item.extra_data || {};
  const variations = extraData.variations || [];
  const benefits = extraData.benefits || [];
  const features = extraData.features || [];
  const faqs = extraData.faqs || [];
  const videos = extraData.videos || [];

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <title>${escapeHtml(seoTitle)}</title>
  <meta name="description" content="${escapeHtml(metaDescription)}" />
  ${keywords.length > 0 ? `<meta name="keywords" content="${keywords.map(escapeHtml).join(', ')}" />` : ''}
  <link rel="canonical" href="${canonicalUrl}" />
  
  <meta property="og:title" content="${escapeHtml(seoTitle)}" />
  <meta property="og:description" content="${escapeHtml(metaDescription)}" />
  <meta property="og:image" content="${ogImage}" />
  <meta property="og:url" content="${canonicalUrl}" />
  <meta property="og:type" content="${category === 'product' ? 'product' : 'article'}" />
  
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(seoTitle)}" />
  <meta name="twitter:description" content="${escapeHtml(metaDescription)}" />
  <meta name="twitter:image" content="${ogImage}" />
  
  <script type="application/ld+json">
  ${JSON.stringify(category === 'product' ? {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": item.name,
    "description": item.description,
    "image": ogImage,
    "brand": { "@type": "Brand", "name": "Smart Dent" },
    "offers": {
      "@type": "Offer",
      "url": canonicalUrl,
      "priceCurrency": item.currency || "BRL",
      "price": item.price || item.promo_price || undefined,
      "availability": "https://schema.org/InStock"
    },
    ...(faqs.length > 0 && {
      "mainEntity": faqs.map((faq: any) => ({
        "@type": "Question",
        "name": faq.question,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": faq.answer
        }
      }))
    })
  } : {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": item.name,
    "description": item.description,
    "image": ogImage,
    "author": { "@type": "Organization", "name": "Smart Dent" },
    "publisher": { "@type": "Organization", "name": "Smart Dent" }
  })}
  </script>
</head>
<body>
  <h1>${escapeHtml(item.name)}</h1>
  ${item.description ? `<p>${escapeHtml(item.description)}</p>` : ''}
  
  ${item.image_url ? `<img src="${escapeHtml(item.image_url)}" alt="${escapeHtml(item.name)}" />` : ''}
  
  ${benefits.length > 0 ? `
    <h2>Benefícios</h2>
    <ul>${benefits.map((b: string) => `<li>${escapeHtml(b)}</li>`).join('')}</ul>
  ` : ''}
  
  ${features.length > 0 ? `
    <h2>Características</h2>
    <ul>${features.map((f: string) => `<li>${escapeHtml(f)}</li>`).join('')}</ul>
  ` : ''}
  
  ${variations.length > 0 ? `
    <h2>Opções Disponíveis</h2>
    <ul>${variations.map((v: any) => `
      <li>
        <strong>${escapeHtml(v.name)}</strong>
        ${v.price ? ` - R$ ${v.price}` : ''}
        ${v.description ? `<br>${escapeHtml(v.description)}` : ''}
      </li>
    `).join('')}</ul>
  ` : ''}
  
  ${videos.length > 0 ? `
    <h2>Vídeos</h2>
    <ul>${videos.map((video: any) => `<li><a href="${escapeHtml(video.url)}">${escapeHtml(video.title || 'Assistir vídeo')}</a></li>`).join('')}</ul>
  ` : ''}
  
  ${faqs.length > 0 ? `
    <h2>Perguntas Frequentes</h2>
    ${faqs.map((faq: any) => `
      <div>
        <h3>${escapeHtml(faq.question)}</h3>
        <p>${escapeHtml(faq.answer)}</p>
      </div>
    `).join('')}
  ` : ''}
  
  ${item.price ? `<p><strong>Preço:</strong> R$ ${item.price}</p>` : ''}
  ${item.promo_price ? `<p><strong>Preço promocional:</strong> R$ ${item.promo_price}</p>` : ''}
  
  ${item.cta_1_url ? `
    <p>
      <a href="${escapeHtml(item.cta_1_url)}" target="_blank" rel="noopener">
        ${escapeHtml(item.cta_1_label || 'Ver na Loja')}
      </a>
      ${item.cta_1_description ? `<br><small>${escapeHtml(item.cta_1_description)}</small>` : ''}
    </p>
  ` : ''}
  
  ${item.cta_2_url ? `
    <p>
      <a href="${escapeHtml(item.cta_2_url)}" target="_blank" rel="noopener">
        ${escapeHtml(item.cta_2_label || 'Saiba Mais')}
      </a>
    </p>
  ` : ''}
  
  <script>
  (function() {
    var ua = navigator.userAgent.toLowerCase();
    var isBot = /bot|crawler|spider|googlebot|bingbot|slurp|facebook|twitter|whatsapp/i.test(ua);
    if (!isBot && !navigator.webdriver) {
      window.location.href = "/${categoryPath}/${slug}";
    }
  })();
  </script>
</body>
</html>`;
}

async function generateKnowledgeHubHTML(supabase: any): Promise<string> {
  const { data: categories, error } = await supabase
    .from('knowledge_categories')
    .select('*, knowledge_contents(count)')
    .eq('enabled', true)
    .order('order_index');

  if (error) {
    console.error('Supabase error fetching knowledge categories:', error.message);
  }

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
  <script>
  (function() {
    var ua = navigator.userAgent.toLowerCase();
    var isBot = /bot|crawler|spider|googlebot|bingbot|slurp|facebook|twitter|whatsapp/i.test(ua);
    if (!isBot && !navigator.webdriver) {
      window.location.href = "/base-conhecimento";
    }
  })();
  </script>
</body>
</html>`;
}

async function generateKnowledgeCategoryHTML(letter: string, supabase: any): Promise<string> {
  const { data: category, error: categoryError } = await supabase
    .from('knowledge_categories')
    .select('*')
    .eq('letter', letter.toUpperCase())
    .eq('enabled', true)
    .single();

  if (categoryError) {
    console.error('Supabase error fetching category:', letter, categoryError.message);
    return '';
  }

  if (!category) {
    console.log('Category not found:', letter);
    return '';
  }

  const { data: contents, error: contentsError } = await supabase
    .from('knowledge_contents')
    .select('title, slug, excerpt')
    .eq('category_id', category.id)
    .eq('active', true)
    .order('order_index')
    .limit(50);

  if (contentsError) {
    console.error('Supabase error fetching contents:', contentsError.message);
  }

  const baseUrl = 'https://parametros.smartdent.com.br';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <title>${escapeHtml(category.letter)} - ${escapeHtml(category.name)} | Base de Conhecimento</title>
  <meta name="description" content="Artigos sobre ${escapeHtml(category.name)}. ${contents?.length || 0} conteúdos disponíveis." />
  <link rel="canonical" href="${baseUrl}/base-conhecimento/${letter.toLowerCase()}" />
  <meta property="og:title" content="${escapeHtml(category.name)}" />
  <script type="application/ld+json">
  ${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Início", "item": baseUrl },
      { "@type": "ListItem", "position": 2, "name": "Base de Conhecimento", "item": `${baseUrl}/base-conhecimento` },
      { "@type": "ListItem", "position": 3, "name": escapeHtml(category.name), "item": `${baseUrl}/base-conhecimento/${letter.toLowerCase()}` }
    ]
  })}
  </script>
</head>
<body>
  <h1>${escapeHtml(category.letter)} - ${escapeHtml(category.name)}</h1>
  <p>${contents?.length || 0} artigos disponíveis nesta categoria.</p>
  <ul>
    ${contents?.map((c: any) => `<li><a href="/base-conhecimento/${letter.toLowerCase()}/${c.slug}">${c.title}</a></li>`).join('') || ''}
  </ul>
  <script>
  (function() {
    var ua = navigator.userAgent.toLowerCase();
    var isBot = /bot|crawler|spider|googlebot|bingbot|slurp|facebook|twitter|whatsapp/i.test(ua);
    if (!isBot && !navigator.webdriver) {
      window.location.href = "/base-conhecimento/${letter.toLowerCase()}";
    }
  })();
  </script>
</body>
</html>`;
}

async function generateKnowledgeArticleHTML(letter: string, slug: string, supabase: any): Promise<string> {
  const { data: content, error } = await supabase
    .from('knowledge_contents')
    .select('*, knowledge_categories(*), authors(*)')
    .eq('slug', slug)
    .eq('active', true)
    .single();

  if (error) {
    console.error('Supabase error fetching article:', slug, error.message);
    return '';
  }

  if (!content) {
    console.log('Article not found:', slug);
    return '';
  }

  // Buscar vídeos relacionados ao artigo
  const { data: videos } = await supabase
    .from('knowledge_videos')
    .select('*')
    .eq('content_id', content.id)
    .order('order_index');

  const desc = content.meta_description || content.excerpt || 
    (content.content_html?.replace(/<[^>]*>/g, '').substring(0, 160) + '...');

  const baseUrl = 'https://parametros.smartdent.com.br';

  // Gerar VideoObject schemas
  const videoSchemas = (videos || []).map((video: any, idx: number) => {
    const videoId = video.url.includes('youtube.com/watch?v=') 
      ? video.url.split('v=')[1]?.split('&')[0] 
      : video.url.split('youtu.be/')[1]?.split('?')[0];
    
    return {
      "@type": "VideoObject",
      "name": video.title || `${content.title} - Vídeo ${idx + 1}`,
      "description": content.meta_description || content.excerpt,
      "thumbnailUrl": videoId ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` : content.og_image_url,
      "uploadDate": content.created_at,
      "contentUrl": video.url,
      "embedUrl": video.url.replace('watch?v=', 'embed/'),
      "duration": "PT15M"
    };
  });

  // Gerar FAQPage schema se houver FAQs
  const faqSchema = (content.faqs && Array.isArray(content.faqs) && content.faqs.length > 0) ? {
    "@type": "FAQPage",
    "mainEntity": content.faqs.map((faq: any) => ({
      "@type": "Question",
      "name": faq.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.answer
      }
    }))
  } : null;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <title>${escapeHtml(content.title)} | Base de Conhecimento Smart Dent</title>
  <meta name="description" content="${escapeHtml(desc)}" />
  <link rel="canonical" href="${baseUrl}/base-conhecimento/${letter}/${slug}" />
  ${content.keywords ? `<meta name="keywords" content="${escapeHtml(content.keywords.join(', '))}" />` : ''}
  
  <!-- Open Graph -->
  <meta property="og:title" content="${escapeHtml(content.title)}" />
  <meta property="og:description" content="${escapeHtml(content.excerpt || desc)}" />
  <meta property="og:type" content="article" />
  ${content.og_image_url || content.content_image_url ? `
  <meta property="og:image" content="${content.og_image_url || content.content_image_url}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="${escapeHtml(content.content_image_alt || content.title)}" />` : ''}
  <meta property="article:published_time" content="${content.created_at}" />
  <meta property="article:modified_time" content="${content.updated_at}" />
  ${content.authors?.name ? `<meta property="article:author" content="${escapeHtml(content.authors.name)}" />` : ''}
  
  <!-- Twitter Card -->
  ${videos && videos.length > 0 ? `
  <meta name="twitter:card" content="player" />
  <meta name="twitter:player" content="${videos[0].url.replace('watch?v=', 'embed/')}" />
  <meta name="twitter:player:width" content="1280" />
  <meta name="twitter:player:height" content="720" />` : content.og_image_url || content.content_image_url ? `
  <meta name="twitter:card" content="summary_large_image" />` : `
  <meta name="twitter:card" content="summary" />`}
  <meta name="twitter:title" content="${escapeHtml(content.title)}" />
  <meta name="twitter:description" content="${escapeHtml(content.excerpt || desc)}" />
  ${content.og_image_url || content.content_image_url ? `<meta name="twitter:image" content="${content.og_image_url || content.content_image_url}" />` : ''}
  
  <!-- Structured Data: @graph com todos os schemas -->
  <script type="application/ld+json">
  ${JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "headline": escapeHtml(content.title),
        "description": escapeHtml(content.excerpt || desc),
        "image": content.og_image_url || content.content_image_url,
        "datePublished": content.created_at,
        "dateModified": content.updated_at,
        "keywords": content.keywords?.join(', ') || undefined,
        "author": content.authors ? {
          "@type": "Person",
          "name": escapeHtml(content.authors.name),
          "url": content.authors.website_url,
          "image": content.authors.photo_url
        } : {
          "@type": "Organization",
          "name": "Smart Dent"
        },
        "publisher": {
          "@type": "Organization",
          "name": "Smart Dent",
          "logo": {
            "@type": "ImageObject",
            "url": `${baseUrl}/og-image.jpg`
          }
        }
      },
      {
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Início", "item": baseUrl },
          { "@type": "ListItem", "position": 2, "name": "Base de Conhecimento", "item": `${baseUrl}/base-conhecimento` },
          { "@type": "ListItem", "position": 3, "name": escapeHtml(content.knowledge_categories?.name || letter.toUpperCase()), "item": `${baseUrl}/base-conhecimento/${letter.toLowerCase()}` },
          { "@type": "ListItem", "position": 4, "name": escapeHtml(content.title), "item": `${baseUrl}/base-conhecimento/${letter}/${slug}` }
        ]
      },
      ...videoSchemas,
      ...(faqSchema ? [faqSchema] : [])
    ]
  })}
  </script>
  
  <!-- Organization Schema -->
  <script type="application/ld+json">
  ${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Smart Dent",
    "url": baseUrl,
    "logo": `${baseUrl}/og-image.jpg`,
    "description": "Base de conhecimento sobre impressão 3D odontológica",
    "sameAs": [
      "https://www.instagram.com/smartdent.br/",
      "https://www.youtube.com/@smartdent",
      "https://www.facebook.com/smartdent.br/"
    ]
  })}
  </script>
</head>
<body>
  <article>
    ${content.content_image_url ? `
    <img 
      src="${content.content_image_url}" 
      alt="${escapeHtml(content.content_image_alt || content.title)}"
      width="1200"
      height="630"
    />` : ''}
    <h1>${escapeHtml(content.title)}</h1>
    <p>${escapeHtml(content.excerpt)}</p>
    ${content.content_html || ''}
    
    ${content.faqs && Array.isArray(content.faqs) && content.faqs.length > 0 ? `
    <section>
      <h2>Perguntas Frequentes</h2>
      ${content.faqs.map((faq: any) => `
      <div>
        <h3>${escapeHtml(faq.question)}</h3>
        <p>${escapeHtml(faq.answer)}</p>
      </div>`).join('')}
    </section>` : ''}
  </article>
  <script>
  (function() {
    var ua = navigator.userAgent.toLowerCase();
    var isBot = /bot|crawler|spider|googlebot|bingbot|slurp|facebook|twitter|whatsapp/i.test(ua);
    if (!isBot && !navigator.webdriver) {
      window.location.href = "/base-conhecimento/${letter}/${slug}";
    }
  })();
  </script>
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
    if (segments[0] === 'produtos' && segments.length === 2) {
      html = await generateSystemACatalogHTML('product', segments[1], supabase);
    } else if (segments[0] === 'depoimentos' && segments.length === 2) {
      html = await generateSystemACatalogHTML('video_testimonial', segments[1], supabase);
    } else if (segments[0] === 'categorias' && segments.length === 2) {
      html = await generateSystemACatalogHTML('category_config', segments[1], supabase);
    } else if (segments[0] === 'base-conhecimento') {
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

    const is404 = !html || html.includes('404 - Página não encontrada');
    const finalHtml = html || generate404();

    return new Response(finalHtml, {
      status: is404 ? 404 : 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': is404 
          ? 'public, s-maxage=300, must-revalidate'
          : 'public, s-maxage=3600, stale-while-revalidate=86400',
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
