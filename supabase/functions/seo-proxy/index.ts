import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Bots de IA / LLM
const AI_BOTS = [
  'gptbot',
  'chatgpt-user',
  'perplexitybot',
  'claudebot',
  'anthropic',
  'anthropic-ai',
  'bytespider',
  'ccbot',
  'cohere-ai',
  'google-extended'
];

// Bots de busca
const SEARCH_BOTS = [
  'googlebot',
  'bingbot',
  'duckduckbot',
  'slurp',
  'baiduspider',
  'yandex',
  'applebot',
  'petalbot',
  'semrushbot',
  'ahrefsbot',
  'dotbot',
  'mj12bot',
  'rogerbot',
  'screaming frog',
  'serpstatbot'
];

// Bots sociais
const SOCIAL_BOTS = [
  'facebookexternalhit',
  'twitterbot',
  'linkedinbot',
  'whatsapp',
  'telegrambot'
];

const ALL_BOTS = [...AI_BOTS, ...SEARCH_BOTS, ...SOCIAL_BOTS];

const isBot = (ua: string): boolean => {
  if (!ua) return false;
  const lowerUa = ua.toLowerCase();
  return ALL_BOTS.some(bot => lowerUa.includes(bot));
};

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

// Universal HowTo Extractor para SEO-Proxy (bots)
function extractHowToStepsFromHTML(htmlContent: string): string[] {
  if (!htmlContent) return [];
  
  const steps: string[] = [];
  
  // Regex patterns para detectar passos em HTML
  const olPattern = /<ol[^>]*>(.*?)<\/ol>/gis;
  const liPattern = /<li[^>]*>(.*?)<\/li>/gi;
  const headingPattern = /<h[2-4][^>]*>(passo|etapa|step)?\s*\d+[:\-\s]+(.*?)<\/h[2-4]>/gi;
  const tablePattern = /<tr[^>]*>.*?<td[^>]*>(passo|etapa)?\s*\d+.*?<\/td>.*?<td[^>]*>(.*?)<\/td>.*?<\/tr>/gis;
  
  // Método 1: Listas ordenadas (prioridade máxima)
  const olMatches = htmlContent.match(olPattern);
  if (olMatches) {
    olMatches.forEach(ol => {
      const liMatches = ol.match(liPattern);
      if (liMatches) {
        liMatches.forEach(li => {
          const text = li.replace(/<[^>]*>/g, '').trim();
          if (text.length > 10) steps.push(text);
        });
      }
    });
  }
  
  // Método 2: Headings numerados (se lista vazia)
  if (steps.length === 0) {
    let match;
    while ((match = headingPattern.exec(htmlContent)) !== null) {
      const stepText = match[2].replace(/<[^>]*>/g, '').trim();
      if (stepText.length > 15) {
        const stepNumber = match[0].match(/\d+/)?.[0] || '';
        steps.push(`${match[1] || 'Passo'} ${stepNumber}: ${stepText}`);
      }
    }
  }
  
  // Método 3: Tabelas (se ainda vazio)
  if (steps.length === 0) {
    let match;
    while ((match = tablePattern.exec(htmlContent)) !== null) {
      const stepText = match[2].replace(/<[^>]*>/g, '').trim();
      if (stepText.length > 15) {
        steps.push(stepText);
      }
    }
  }
  
  return steps.slice(0, 10); // Limitar a 10 passos (boas práticas Google)
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
  <header style="background:#fff;border-bottom:1px solid #e5e7eb;padding:1rem 2rem;margin-bottom:2rem;position:sticky;top:0;z-index:100;box-shadow:0 1px 3px rgba(0,0,0,0.05)">
    <a href="https://smartdent.com.br" target="_blank" rel="noopener noreferrer" style="text-decoration:none;display:inline-flex;align-items:center;gap:0.75rem;transition:opacity 0.2s" onmouseover="this.style.opacity='0.7'" onmouseout="this.style.opacity='1'">
      <img 
        src="https://pgfgripuanuwwolmtknn.supabase.co/storage/v1/object/public/product-images/h7stblp3qxn_1760720051743.png"
        alt="Smart Dent Logo"
        onerror="this.style.display='none'"
        style="height:48px;max-height:48px;width:auto;object-fit:contain"
        loading="lazy"
      />
      <span style="color:#2563eb;font-size:1.5rem;font-weight:700">Smart Dent</span>
    </a>
    <p style="margin:0.5rem 0 0 0;font-size:0.875rem;color:#6b7280;font-weight:400">Parâmetros de Impressão 3D Odontológica</p>
  </header>
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
  <header style="background:#fff;border-bottom:1px solid #e5e7eb;padding:1rem 2rem;margin-bottom:2rem;position:sticky;top:0;z-index:100;box-shadow:0 1px 3px rgba(0,0,0,0.05)">
    <a href="https://smartdent.com.br" target="_blank" rel="noopener noreferrer" style="text-decoration:none;display:inline-flex;align-items:center;gap:0.75rem;transition:opacity 0.2s" onmouseover="this.style.opacity='0.7'" onmouseout="this.style.opacity='1'">
      <img 
        src="https://pgfgripuanuwwolmtknn.supabase.co/storage/v1/object/public/product-images/h7stblp3qxn_1760720051743.png"
        alt="Smart Dent Logo"
        onerror="this.style.display='none'"
        style="height:48px;max-height:48px;width:auto;object-fit:contain"
        loading="lazy"
      />
      <span style="color:#2563eb;font-size:1.5rem;font-weight:700">Smart Dent</span>
    </a>
    <p style="margin:0.5rem 0 0 0;font-size:0.875rem;color:#6b7280;font-weight:400">Parâmetros de Impressão 3D Odontológica</p>
  </header>
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
  <header style="background:#fff;border-bottom:1px solid #e5e7eb;padding:1rem 2rem;margin-bottom:2rem;position:sticky;top:0;z-index:100;box-shadow:0 1px 3px rgba(0,0,0,0.05)">
    <a href="https://smartdent.com.br" target="_blank" rel="noopener noreferrer" style="text-decoration:none;display:inline-flex;align-items:center;gap:0.75rem;transition:opacity 0.2s" onmouseover="this.style.opacity='0.7'" onmouseout="this.style.opacity='1'">
      <img 
        src="https://pgfgripuanuwwolmtknn.supabase.co/storage/v1/object/public/product-images/h7stblp3qxn_1760720051743.png"
        alt="Smart Dent Logo"
        onerror="this.style.display='none'"
        style="height:48px;max-height:48px;width:auto;object-fit:contain"
        loading="lazy"
      />
      <span style="color:#2563eb;font-size:1.5rem;font-weight:700">Smart Dent</span>
    </a>
    <p style="margin:0.5rem 0 0 0;font-size:0.875rem;color:#6b7280;font-weight:400">Parâmetros de Impressão 3D Odontológica</p>
  </header>
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
  // Buscar parameter_sets primeiro
  const { data: paramSets, error: paramError } = await supabase
    .from('parameter_sets')
    .select('*')
    .eq('brand_slug', brandSlug)
    .eq('model_slug', modelSlug)
    .eq('active', true);

  if (paramError) {
    console.error('Supabase error fetching parameter_sets:', paramError.message);
    return '';
  }

  if (!paramSets || paramSets.length === 0) {
    console.log('No parameter_sets found for:', brandSlug, modelSlug);
    return '';
  }

  // FASE 4: Matching robusto de slugs para encontrar o parameter_set correto
  const paramData = paramSets.find((p: any) => {
    const dbSlug = normalizeSlug(`${p.resin_manufacturer}-${p.resin_name}`);
    const requestSlug = normalizeSlug(resinSlug);
    return dbSlug === requestSlug;
  }) || paramSets[0];

  // Buscar dados da resina separadamente
  const { data: resinData, error: resinError } = await supabase
    .from('resins')
    .select('*')
    .eq('manufacturer', paramData.resin_manufacturer)
    .eq('name', paramData.resin_name)
    .eq('active', true)
    .maybeSingle();

  if (resinError) {
    console.error('Supabase error fetching resin:', resinError.message);
  }

  // Usar parameter_set como fonte principal
  const params = paramData;

  const baseUrl = 'https://parametros.smartdent.com.br';
  
  // Usar campos SEO da tabela resins se disponível
  const resinName = params.resin_name;
  const resinManufacturer = params.resin_manufacturer;
  const seoTitle = resinData?.seo_title_override || `${escapeHtml(resinName)} para ${escapeHtml(modelSlug)} - Parâmetros | Smart Dent`;
  const metaDescription = resinData?.meta_description || `Parâmetros profissionais testados: ${escapeHtml(resinName)}. Layer: ${params.layer_height}mm, Cure: ${params.cure_time}s, Luz: ${params.light_intensity}%.`;
  const canonicalUrl = resinData?.canonical_url || `${baseUrl}/${brandSlug}/${modelSlug}/${resinSlug}`;
  const ogImage = resinData?.og_image_url || resinData?.image_url || `${baseUrl}/og-image.jpg`;
  const keywords = resinData?.keywords || [];

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <title>${seoTitle}</title>
  <meta name="description" content="${metaDescription}" />
  ${keywords.length > 0 ? `<meta name="keywords" content="${keywords.map(escapeHtml).join(', ')}" />` : ''}
  <link rel="canonical" href="${canonicalUrl}" />
  <meta property="og:title" content="${escapeHtml(resinData?.name || resinName)} - Parâmetros de Impressão" />
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
    "name": escapeHtml(resinName),
    "description": resinData?.description || `Resina ${escapeHtml(resinName)} com parâmetros otimizados`,
    "brand": {
      "@type": "Brand",
      "name": escapeHtml(resinManufacturer)
    },
    "image": ogImage,
    "offers": {
      "@type": "Offer",
      "availability": "https://schema.org/InStock",
      "url": canonicalUrl,
      "price": resinData?.price || undefined,
      "priceCurrency": resinData?.price ? "BRL" : undefined
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
      { "@type": "ListItem", "position": 4, "name": `${escapeHtml(resinManufacturer)} ${escapeHtml(resinName)}`, "item": canonicalUrl }
    ]
  })}
  </script>
</head>
<body>
  <header style="background:#fff;border-bottom:1px solid #e5e7eb;padding:1rem 2rem;margin-bottom:2rem;position:sticky;top:0;z-index:100;box-shadow:0 1px 3px rgba(0,0,0,0.05)">
    <a href="https://smartdent.com.br" target="_blank" rel="noopener noreferrer" style="text-decoration:none;display:inline-flex;align-items:center;gap:0.75rem;transition:opacity 0.2s" onmouseover="this.style.opacity='0.7'" onmouseout="this.style.opacity='1'">
      <img 
        src="https://pgfgripuanuwwolmtknn.supabase.co/storage/v1/object/public/product-images/h7stblp3qxn_1760720051743.png"
        alt="Smart Dent Logo"
        onerror="this.style.display='none'"
        style="height:48px;max-height:48px;width:auto;object-fit:contain"
        loading="lazy"
      />
      <span style="color:#2563eb;font-size:1.5rem;font-weight:700">Smart Dent</span>
    </a>
    <p style="margin:0.5rem 0 0 0;font-size:0.875rem;color:#6b7280;font-weight:400">Parâmetros de Impressão 3D Odontológica</p>
  </header>
  <h1>${escapeHtml(resinName)}</h1>
  <p>${resinData?.description || `Parâmetros profissionais testados para ${escapeHtml(resinName)} na impressora ${escapeHtml(modelSlug)}.`}</p>
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
  ${resinData?.cta_1_url ? `<p><a href="${escapeHtml(resinData.cta_1_url)}" target="_blank">${escapeHtml(resinData.cta_1_label || 'Saiba mais')}</a></p>` : ''}
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
  // FIX: Handle both slug formats (simple slug and full URLs)
  const { data: item, error } = await supabase
    .from('system_a_catalog')
    .select('*')
    .eq('category', category)
    .or(`slug.eq.${slug},slug.like.%/${slug}`)
    .eq('active', true)
    .eq('approved', true)
    .maybeSingle();

  if (error || !item) return generate404();

  const baseUrl = 'https://parametros.smartdent.com.br';
  // SEO Meta Tags: Use product-specific data when available
  const seoTitle = category === 'product' 
    ? (item.seo_title_override || `${item.name} | Smart Dent - Odontologia de Precisão`)
    : category === 'video_testimonial'
    ? `Depoimento: ${item.name} - Experiência Real com Smart Dent`
    : (item.seo_title_override || `${item.name} - Smart Dent`);
  
  const metaDescription = category === 'product'
    ? (item.meta_description || 
       item.description?.replace(/<[^>]*>/g, '').substring(0, 155) || 
       `Conheça ${item.name} - Alta qualidade para sua clínica odontológica.${item.price ? ` A partir de R$ ${item.price}` : ''}`)
    : category === 'video_testimonial'
    ? `Confira o depoimento de ${item.name} sobre sua experiência com produtos Smart Dent. ${item.description?.substring(0, 100) || ''}`
    : (item.meta_description || item.description || '');
  
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
  <meta name="twitter:site" content="@smartdent" />
  <meta name="twitter:creator" content="@smartdent" />
  <meta name="twitter:title" content="${escapeHtml(seoTitle)}" />
  <meta name="twitter:description" content="${escapeHtml(metaDescription)}" />
  <meta name="twitter:image" content="${ogImage}" />
  <meta name="twitter:image:alt" content="${escapeHtml(item.name)}" />
  
  <!-- Structured Data: Product/Review Schema with BreadcrumbList -->
  <script type="application/ld+json">
  ${JSON.stringify(category === 'product' ? {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Product",
        "name": item.name,
        "description": item.description,
        "image": ogImage,
        "brand": { "@type": "Brand", "name": "Smart Dent" },
        "offers": {
          "@type": "Offer",
          "url": canonicalUrl,
          "priceCurrency": item.currency || "BRL",
          "price": item.promo_price || item.price || undefined,
          "availability": "https://schema.org/InStock"
        },
        ...(item.rating && item.review_count > 0 && {
          "aggregateRating": {
            "@type": "AggregateRating",
            "ratingValue": item.rating,
            "reviewCount": item.review_count,
            "bestRating": 5,
            "worstRating": 1
          }
        }),
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
      },
      {
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Início", "item": baseUrl },
          { "@type": "ListItem", "position": 2, "name": "Produtos", "item": `${baseUrl}/produtos` },
          { "@type": "ListItem", "position": 3, "name": item.name, "item": canonicalUrl }
        ]
      }
    ]
  } : category === 'video_testimonial' ? {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Review",
        "itemReviewed": {
          "@type": "Product",
          "name": extraData.products_mentioned?.[0] || "Smart Dent",
          "brand": { "@type": "Brand", "name": "Smart Dent" }
        },
        "reviewRating": {
          "@type": "Rating",
          "ratingValue": extraData.rating || 5,
          "bestRating": 5,
          "worstRating": 1
        },
        "author": {
          "@type": "Person",
          "name": item.name,
          "jobTitle": extraData.specialty,
          "address": extraData.location ? {
            "@type": "PostalAddress",
            "addressLocality": extraData.location
          } : undefined
        },
        "reviewBody": item.description,
        "datePublished": item.created_at,
        ...(videos.length > 0 && {
          "video": {
            "@type": "VideoObject",
            "name": videos[0].title || item.name,
            "description": item.description,
            "thumbnailUrl": videos[0].thumbnail_url || ogImage,
            "uploadDate": item.created_at,
            "contentUrl": videos[0].url,
            "embedUrl": videos[0].embed_url || videos[0].url,
            "duration": videos[0].duration || "PT5M"
          }
        })
      },
      {
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Início", "item": baseUrl },
          { "@type": "ListItem", "position": 2, "name": "Depoimentos", "item": `${baseUrl}/depoimentos` },
          { "@type": "ListItem", "position": 3, "name": item.name, "item": canonicalUrl }
        ]
      }
    ]
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
  <header style="background:#fff;border-bottom:1px solid #e5e7eb;padding:1rem 2rem;margin-bottom:2rem;position:sticky;top:0;z-index:100;box-shadow:0 1px 3px rgba(0,0,0,0.05)">
    <a href="https://smartdent.com.br" target="_blank" rel="noopener noreferrer" style="text-decoration:none;display:inline-flex;align-items:center;gap:0.75rem;transition:opacity 0.2s" onmouseover="this.style.opacity='0.7'" onmouseout="this.style.opacity='1'">
      <img 
        src="https://pgfgripuanuwwolmtknn.supabase.co/storage/v1/object/public/product-images/h7stblp3qxn_1760720051743.png"
        alt="Smart Dent Logo"
        onerror="this.style.display='none'"
        style="height:48px;max-height:48px;width:auto;object-fit:contain"
        loading="lazy"
      />
      <span style="color:#2563eb;font-size:1.5rem;font-weight:700">Smart Dent</span>
    </a>
    <p style="margin:0.5rem 0 0 0;font-size:0.875rem;color:#6b7280;font-weight:400">Parâmetros de Impressão 3D Odontológica</p>
  </header>
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
  
  ${item.rating && item.review_count > 0 ? `
    <p>
      <strong>Avaliação:</strong> 
      ${'⭐'.repeat(Math.round(item.rating))} 
      ${item.rating.toFixed(1)}/5 
      (${item.review_count} ${item.review_count === 1 ? 'avaliação' : 'avaliações'})
    </p>
  ` : ''}
  
  ${item.promo_price && item.price ? `
    <p>
      <strong>De:</strong> <s>R$ ${item.price.toFixed(2)}</s><br>
      <strong>Por:</strong> <span style="color:#e74c3c;font-size:1.2em">R$ ${item.promo_price.toFixed(2)}</span>
      <span style="color:#27ae60;font-weight:bold">
        (${Math.round(((item.price - item.promo_price) / item.price) * 100)}% OFF)
      </span>
    </p>
  ` : item.price ? `
    <p><strong>Preço:</strong> R$ ${item.price.toFixed(2)}</p>
  ` : ''}
  
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
      ${item.cta_2_description ? `<br><small>${escapeHtml(item.cta_2_description)}</small>` : ''}
    </p>
  ` : ''}
  
  ${item.cta_3_url ? `
    <p>
      <a href="${escapeHtml(item.cta_3_url)}" target="_blank" rel="noopener">
        ${escapeHtml(item.cta_3_label || 'Mais Informações')}
      </a>
      ${item.cta_3_description ? `<br><small>${escapeHtml(item.cta_3_description)}</small>` : ''}
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
  <link rel="canonical" href="${baseUrl}/conhecimento" />
  <meta property="og:title" content="Base de Conhecimento Smart Dent" />
  <meta property="og:type" content="website" />
  <script type="application/ld+json">
  ${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "Base de Conhecimento Smart Dent",
    "url": `${baseUrl}/conhecimento`,
    "description": "Artigos e tutoriais sobre impressão 3D odontológica"
  })}
  </script>
</head>
<body>
  <h1>Base de Conhecimento</h1>
  <p>Artigos, tutoriais e guias sobre impressão 3D odontológica.</p>
  <h2>Categorias</h2>
  <ul>
    ${categories?.map((c: any) => `<li><a href="/conhecimento/${c.letter.toLowerCase()}">${c.letter} - ${c.name}</a></li>`).join('') || ''}
  </ul>
  <script>
  (function() {
    var ua = navigator.userAgent.toLowerCase();
    var isBot = /bot|crawler|spider|googlebot|bingbot|slurp|facebook|twitter|whatsapp/i.test(ua);
    if (!isBot && !navigator.webdriver) {
      window.location.href = "/conhecimento";
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

  // Buscar resinas recomendadas com brand/model slugs
  let recommendedResins: any[] = [];
  if (content.recommended_resins && content.recommended_resins.length > 0) {
    const { data: resinsData } = await supabase
      .from('resins')
      .select('id, slug, name, manufacturer, image_url, price')
      .in('slug', content.recommended_resins)
      .eq('active', true);
    
    if (resinsData && resinsData.length > 0) {
      // Para cada resina, buscar brand_slug e model_slug via parameter_sets
      const resinsWithPaths = await Promise.all(
        resinsData.map(async (resin) => {
          const { data: paramSet } = await supabase
            .from('parameter_sets')
            .select('brand_slug, model_slug')
            .eq('resin_name', resin.name)
            .eq('active', true)
            .limit(1)
            .single();
          
          return {
            ...resin,
            brand_slug: paramSet?.brand_slug,
            model_slug: paramSet?.model_slug
          };
        })
      );
      recommendedResins = resinsWithPaths;
    }
  }

  const desc = content.meta_description || content.excerpt || 
    (content.content_html?.replace(/<[^>]*>/g, '').substring(0, 160) + '...');

  const baseUrl = 'https://parametros.smartdent.com.br';

  // Gerar VideoObject schemas (suporte YouTube e PandaVideo)
  const videoSchemas = (videos || []).map((video: any, idx: number) => {
    const youtubeUrl = video.url || null;
    const pandaEmbedUrl = video.embed_url || null;
    const pandaThumbnail = video.thumbnail_url || null;
    
    // Extrair ID do YouTube se aplicável
    let videoId: string | null = null;
    if (youtubeUrl) {
      if (youtubeUrl.includes('youtube.com/watch?v=')) {
        videoId = youtubeUrl.split('v=')[1]?.split('&')[0] || null;
      } else if (youtubeUrl.includes('youtu.be/')) {
        videoId = youtubeUrl.split('youtu.be/')[1]?.split('?')[0] || null;
      }
    }
    
    // Determinar URLs finais
    const contentUrl = youtubeUrl || pandaEmbedUrl;
    const embedUrl = youtubeUrl 
      ? youtubeUrl.replace('watch?v=', 'embed/')
      : pandaEmbedUrl;
    const thumbnailUrl = videoId 
      ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
      : (pandaThumbnail || content.og_image_url || content.content_image_url);
    
    // Só gerar schema se houver alguma URL válida
    if (!contentUrl && !embedUrl) return null;
    
    return {
      "@type": "VideoObject",
      "name": video.title || `${content.title} - Vídeo ${idx + 1}`,
      "description": content.meta_description || content.excerpt,
      "thumbnailUrl": thumbnailUrl,
      "uploadDate": content.created_at,
      "contentUrl": contentUrl,
      "embedUrl": embedUrl,
      "duration": video.video_duration_seconds 
        ? `PT${Math.floor(video.video_duration_seconds / 60)}M${video.video_duration_seconds % 60}S`
        : "PT5M"
    };
  }).filter(Boolean);

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
  
  <!-- FASE 3: AI-Context Meta Tag (Experimental para IA Regenerativa) -->
  <meta name="AI-context" content="Conteúdo técnico-científico sobre ${escapeHtml(content.knowledge_categories?.name || 'odontologia')}. Público-alvo: cirurgiões-dentistas e técnicos em prótese dentária. Nível: Expert. Tipo: Artigo técnico." />
  
  <!-- FASE 3: Open Graph Otimizado para IA -->
  <meta property="og:title" content="${escapeHtml(content.title)}" />
  <meta property="og:description" content="${escapeHtml(content.excerpt || desc)}" />
  <meta property="og:type" content="article" />
  ${content.og_image_url || content.content_image_url ? `
  <meta property="og:image" content="${content.og_image_url || content.content_image_url}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="${escapeHtml(content.content_image_alt || content.title)}" />` : ''}
  <meta property="article:section" content="${escapeHtml(content.knowledge_categories?.name || 'Conhecimento')}" />
  <meta property="article:published_time" content="${content.created_at}" />
  <meta property="article:modified_time" content="${content.updated_at}" />
  ${content.keywords ? content.keywords.slice(0, 10).map((kw: string) => `<meta property="article:tag" content="${escapeHtml(kw)}" />`).join('\n  ') : ''}
  ${content.authors?.name ? `<meta property="article:author" content="${escapeHtml(content.authors.name)}" />` : ''}
  ${content.authors?.instagram_url ? `<meta property="article:author:instagram" content="${escapeHtml(content.authors.instagram_url)}" />` : ''}
  ${content.authors?.linkedin_url ? `<meta property="article:author:linkedin" content="${escapeHtml(content.authors.linkedin_url)}" />` : ''}
  
  <!-- Twitter Card (com suporte YouTube e PandaVideo) -->
  ${(() => {
    // Determinar se há vídeo válido para player card
    const firstVideo = videos && videos.length > 0 ? videos[0] : null;
    const youtubeUrl = firstVideo?.url || null;
    const pandaEmbedUrl = firstVideo?.embed_url || null;
    
    // Gerar embed URL apenas para YouTube (PandaVideo usa summary_large_image)
    let playerUrl = null;
    if (youtubeUrl && (youtubeUrl.includes('youtube.com/watch?v=') || youtubeUrl.includes('youtu.be/'))) {
      playerUrl = youtubeUrl.replace('watch?v=', 'embed/');
    }
    
    if (playerUrl) {
      return `<meta name="twitter:card" content="player" />
  <meta name="twitter:player" content="${playerUrl}" />
  <meta name="twitter:player:width" content="1280" />
  <meta name="twitter:player:height" content="720" />`;
    } else if (content.og_image_url || content.content_image_url) {
      return `<meta name="twitter:card" content="summary_large_image" />`;
    } else {
      return `<meta name="twitter:card" content="summary" />`;
    }
  })()}
  <meta name="twitter:site" content="@smartdent" />
  <meta name="twitter:creator" content="${content.authors?.twitter_url ? '@' + content.authors.twitter_url.split('/').pop() : '@smartdent'}" />
  <meta name="twitter:title" content="${escapeHtml(content.title)}" />
  <meta name="twitter:description" content="${escapeHtml(content.excerpt || desc)}" />
  ${content.og_image_url || content.content_image_url ? `<meta name="twitter:image" content="${content.og_image_url || content.content_image_url}" />` : ''}
  ${content.og_image_url || content.content_image_url ? `<meta name="twitter:image:alt" content="${escapeHtml(content.content_image_alt || content.title)}" />` : ''}
  
  <!-- Structured Data: @graph com TechArticle/HowTo + BreadcrumbList -->
  <script type="application/ld+json">
  ${JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "TechArticle",
        "headline": escapeHtml(content.title),
        "description": escapeHtml(content.excerpt || desc),
        "image": content.og_image_url || content.content_image_url,
        "datePublished": content.created_at,
        "dateModified": content.updated_at,
        "keywords": content.keywords?.join(', ') || undefined,
        "articleBody": content.content_html?.replace(/<[^>]*>/g, '').substring(0, 5000),
        "proficiencyLevel": "Expert",
        "dependencies": recommendedResins.length > 0 ? recommendedResins.map((r: any) => r.name).join(', ') : undefined,
        "author": content.authors ? {
          "@type": "Person",
          "name": escapeHtml(content.authors.name),
          "url": content.authors.website_url,
          "image": content.authors.photo_url,
          "jobTitle": content.authors.specialty,
          "description": content.authors.mini_bio,
          "sameAs": [
            content.authors.lattes_url,
            content.authors.instagram_url,
            content.authors.youtube_url,
            content.authors.linkedin_url,
            content.authors.facebook_url,
            content.authors.twitter_url,
            content.authors.tiktok_url,
            content.authors.website_url
          ].filter(Boolean)
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
      ...(faqSchema ? [faqSchema] : []),
      // HowTo Schema - Universal Extractor
      ...(() => {
        const howToSteps = extractHowToStepsFromHTML(content.content_html || '');
        if (howToSteps.length >= 3) {
          return [{
            "@type": "HowTo",
            "name": `Como usar: ${escapeHtml(content.title)}`,
            "description": escapeHtml(content.excerpt || desc),
            "totalTime": "PT15M",
            "step": howToSteps.map((step, idx) => ({
              "@type": "HowToStep",
              "position": idx + 1,
              "name": step.substring(0, 100),
              "text": step,
              "url": `${baseUrl}/base-conhecimento/${letter}/${slug}#passo-${idx + 1}`
            }))
          }];
        }
        return [];
      })(),
      // FASE 2: LearningResource Schema para IA Regenerativa
      {
        "@type": "LearningResource",
        "name": escapeHtml(content.title),
        "description": escapeHtml(content.excerpt || desc),
        "abstract": escapeHtml(desc),
        "learningResourceType": "Article",
        "educationalLevel": "Expert",
        "teaches": content.keywords?.slice(0, 5) || [],
        "competencyRequired": "Conhecimento em odontologia e impressão 3D",
        "audience": {
          "@type": "EducationalAudience",
          "educationalRole": "Professional",
          "audienceType": "Cirurgiões-dentistas, técnicos em prótese dentária"
        },
        "inLanguage": "pt-BR",
        "isAccessibleForFree": true,
        "author": content.authors ? {
          "@type": "Person",
          "name": escapeHtml(content.authors.name),
          "url": content.authors.website_url
        } : {
          "@type": "Organization",
          "name": "Smart Dent",
          "url": baseUrl
        },
        "publisher": {
          "@type": "Organization",
          "name": "Smart Dent",
          "url": baseUrl,
          "logo": {
            "@type": "ImageObject",
            "url": `${baseUrl}/og-image.jpg`
          }
        },
        "datePublished": content.created_at,
        "dateModified": content.updated_at
      }
    ]
  })}
  </script>
  
  <!-- FASE 2: Organization Schema com E-E-A-T Enhancement -->
  <script type="application/ld+json">
  ${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Smart Dent",
    "url": baseUrl,
    "logo": `${baseUrl}/og-image.jpg`,
    "description": "Base de conhecimento sobre impressão 3D odontológica",
    "expertise": "Fabricação de resinas odontológicas para impressão 3D, desenvolvimento de parâmetros de impressão otimizados",
    "knowsAbout": [
      "Impressão 3D odontológica",
      "Resinas fotopolimerizáveis",
      "Biocompatibilidade dental",
      "Prótese dentária digital",
      "Ortodontia digital",
      "Planejamento virtual odontológico"
    ],
    "award": [
      "Certificação ISO 13485 - Dispositivos Médicos",
      "Registro ANVISA para resinas odontológicas"
    ],
    "certifications": [
      {
        "@type": "Certification",
        "name": "ISO 13485",
        "description": "Sistema de gestão da qualidade para dispositivos médicos"
      },
      {
        "@type": "Certification",
        "name": "ANVISA",
        "description": "Registro sanitário para comercialização de resinas odontológicas no Brasil"
      }
    ],
    "sameAs": [
      "https://www.instagram.com/smartdent.br/",
      "https://www.youtube.com/@smartdent",
      "https://www.facebook.com/smartdent.br/"
    ]
  })}
  </script>
</head>
<body>
  <header style="background:#fff;border-bottom:1px solid #e5e7eb;padding:1rem 2rem;margin-bottom:2rem;position:sticky;top:0;z-index:100;box-shadow:0 1px 3px rgba(0,0,0,0.05)">
    <a href="https://smartdent.com.br" target="_blank" rel="noopener noreferrer" style="text-decoration:none;display:inline-flex;align-items:center;gap:0.75rem;transition:opacity 0.2s" onmouseover="this.style.opacity='0.7'" onmouseout="this.style.opacity='1'">
      <img 
        src="https://pgfgripuanuwwolmtknn.supabase.co/storage/v1/object/public/product-images/h7stblp3qxn_1760720051743.png"
        alt="Smart Dent Logo"
        onerror="this.style.display='none'"
        style="height:48px;max-height:48px;width:auto;object-fit:contain"
        loading="lazy"
      />
      <span style="color:#2563eb;font-size:1.5rem;font-weight:700">Smart Dent</span>
    </a>
    <p style="margin:0.5rem 0 0 0;font-size:0.875rem;color:#6b7280;font-weight:400">Parâmetros de Impressão 3D Odontológica</p>
  </header>
  <article>
    ${content.content_image_url ? `
    <img 
      src="${content.content_image_url}" 
      alt="${escapeHtml(content.content_image_alt || content.title)}"
      style="width: 100%; max-width: 1200px; height: auto; border-radius: 12px; margin: 1.5rem 0; box-shadow: 0 4px 12px rgba(0,0,0,0.1); display: block;"
    />` : ''}
    <h1>${escapeHtml(content.title)}</h1>
    <p>${escapeHtml(content.excerpt)}</p>
    
    ${content.file_url ? `
    <div style="background:#fff3cd;border:1px solid #ffc107;padding:1rem;margin:1rem 0;border-radius:4px">
      <strong>📥 Material Complementar:</strong>
      <a href="${escapeHtml(content.file_url)}" download style="margin-left:0.5rem;color:#007bff;font-weight:bold">
        ${escapeHtml(content.file_name || 'Baixar Arquivo')}
      </a>
    </div>
    ` : ''}
    
    <style>
      article img {
        width: 100% !important;
        max-width: 1200px !important;
        height: auto !important;
        border-radius: 8px;
        margin: 20px auto;
        display: block;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      }
      article img[width="60"],
      article img[width="80"] {
        width: auto !important;
        max-width: 80px !important;
      }
    </style>
    
    <script>
      document.addEventListener('DOMContentLoaded', function() {
        var links = document.querySelectorAll('article a[href^="http"]');
        links.forEach(function(link) {
          link.setAttribute('target', '_blank');
          link.setAttribute('rel', 'noopener noreferrer');
        });
      });
    </script>
    
    ${content.content_html || ''}
    
    ${recommendedResins.length > 0 ? `
    <section style="background:#f9f9f9;padding:1.5rem;margin:2rem 0;border-left:4px solid #007bff">
      <h2>Resinas Recomendadas para Este Artigo</h2>
      <ul style="list-style:none;padding:0">
        ${recommendedResins.map((resin: any) => `
          <li style="margin:1rem 0;display:flex;align-items:center;gap:1rem">
            ${resin.image_url ? `<img src="${resin.image_url}" alt="${escapeHtml(resin.name)}" width="60" height="60" style="border-radius:4px;flex-shrink:0" />` : ''}
            <div>
              <a href="${
                resin.brand_slug && resin.model_slug && (resin.slug || resin.id)
                  ? `https://parametros.smartdent.com.br/${resin.brand_slug}/${resin.model_slug}/${resin.slug || resin.id}`
                  : `https://parametros.smartdent.com.br/resinas/${resin.slug || resin.id}`
              }" style="font-weight:bold;color:#007bff;text-decoration:none">
                ${escapeHtml(resin.name)}
              </a>
              <br><small style="color:#666">${escapeHtml(resin.manufacturer)}</small>
              ${resin.price ? `<br><strong style="color:#007bff">R$ ${resin.price.toFixed(2)}</strong>` : ''}
            </div>
          </li>
        `).join('')}
      </ul>
    </section>
    ` : ''}
    
    ${content.faqs && Array.isArray(content.faqs) && content.faqs.length > 0 ? `
    <section>
      <h2>Perguntas Frequentes</h2>
      ${content.faqs.map((faq: any) => `
      <div>
        <h3>${escapeHtml(faq.question)}</h3>
        <p>${escapeHtml(faq.answer)}</p>
      </div>`).join('')}
    </section>` : ''}
    
    ${content.authors ? `
    <aside style="border-top:2px solid #eee;margin-top:2rem;padding-top:2rem">
      <h3>Sobre o Autor</h3>
      <div style="display:flex;gap:1rem;align-items:start">
        ${content.authors.photo_url ? `
        <img 
          src="${content.authors.photo_url}" 
          alt="${escapeHtml(content.authors.name)}"
          width="80"
          height="80"
          style="border-radius:50%;flex-shrink:0"
        />
        ` : ''}
        <div>
          <h4 style="margin:0">${escapeHtml(content.authors.name)}</h4>
          ${content.authors.specialty ? `<p style="margin:0.25rem 0;color:#666"><em>${escapeHtml(content.authors.specialty)}</em></p>` : ''}
          ${content.authors.mini_bio ? `<p style="margin:0.5rem 0">${escapeHtml(content.authors.mini_bio)}</p>` : ''}
          
          <div style="display:flex;flex-wrap:wrap;gap:0.75rem;margin-top:0.75rem">
            ${content.authors.lattes_url ? `<a href="${escapeHtml(content.authors.lattes_url)}" target="_blank" rel="noopener" title="Currículo Lattes" style="color:#007bff;text-decoration:none">📄 Lattes</a>` : ''}
            ${content.authors.instagram_url ? `<a href="${escapeHtml(content.authors.instagram_url)}" target="_blank" rel="noopener nofollow" style="color:#E4405F;text-decoration:none">📷 Instagram</a>` : ''}
            ${content.authors.youtube_url ? `<a href="${escapeHtml(content.authors.youtube_url)}" target="_blank" rel="noopener nofollow" style="color:#FF0000;text-decoration:none">▶️ YouTube</a>` : ''}
            ${content.authors.linkedin_url ? `<a href="${escapeHtml(content.authors.linkedin_url)}" target="_blank" rel="noopener nofollow" style="color:#0077B5;text-decoration:none">💼 LinkedIn</a>` : ''}
            ${content.authors.facebook_url ? `<a href="${escapeHtml(content.authors.facebook_url)}" target="_blank" rel="noopener nofollow" style="color:#1877F2;text-decoration:none">👥 Facebook</a>` : ''}
            ${content.authors.twitter_url ? `<a href="${escapeHtml(content.authors.twitter_url)}" target="_blank" rel="noopener nofollow" style="color:#1DA1F2;text-decoration:none">🐦 Twitter</a>` : ''}
            ${content.authors.tiktok_url ? `<a href="${escapeHtml(content.authors.tiktok_url)}" target="_blank" rel="noopener nofollow" style="color:#000000;text-decoration:none">🎵 TikTok</a>` : ''}
            ${content.authors.website_url ? `<a href="${escapeHtml(content.authors.website_url)}" target="_blank" rel="noopener" style="color:#007bff;text-decoration:none">🌐 Website</a>` : ''}
          </div>
        </div>
      </div>
    </aside>
    ` : ''}
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
  const path = url.pathname.replace(/^\/seo-proxy/, '').replace(/^\/+$/, ''); // Remove prefixo e trailing slashes
  const segments = path.length === 0 ? [] : path.split('/').filter(Boolean);

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
      // PT: /base-conhecimento/...
      if (segments.length === 1) {
        html = await generateKnowledgeHubHTML(supabase);
      } else if (segments.length === 2) {
        html = await generateKnowledgeCategoryHTML(segments[1], supabase);
      } else if (segments.length === 3) {
        html = await generateKnowledgeArticleHTML(segments[1], segments[2], supabase);
      }
    } else if (segments[0] === 'en' && segments[1] === 'knowledge-base') {
      // EN: /en/knowledge-base/...
      if (segments.length === 2) {
        html = await generateKnowledgeHubHTML(supabase);
      } else if (segments.length === 3) {
        html = await generateKnowledgeCategoryHTML(segments[2], supabase);
      } else if (segments.length === 4) {
        html = await generateKnowledgeArticleHTML(segments[2], segments[3], supabase);
      }
    } else if (segments[0] === 'es' && segments[1] === 'base-conocimiento') {
      // ES: /es/base-conocimiento/...
      if (segments.length === 2) {
        html = await generateKnowledgeHubHTML(supabase);
      } else if (segments.length === 3) {
        html = await generateKnowledgeCategoryHTML(segments[2], supabase);
      } else if (segments.length === 4) {
        html = await generateKnowledgeArticleHTML(segments[2], segments[3], supabase);
      }
    } else if (segments[0] === 'conhecimento') {
      // Legacy: /conhecimento/... (mantido para retrocompatibilidade)
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
