import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const LOGO_URL = "https://pgfgripuanuwwolmtknn.supabase.co/storage/v1/object/public/product-images/h7stblp3qxn_1760720051743.png";

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

// Heurística ampla — captura ferramentas de auditoria, LLMs, scrapers e clientes
// HTTP genéricos que não estão nomeados na allowlist. Sem isso, qualquer UA
// desconhecido caía num Response('') e a IA/auditor via página em branco.
const BOT_HEURISTIC = /bot|crawler|spider|slurp|python|curl|wget|scrapy|headless|node-?fetch|axios|http-?client|postman|insomnia|go-http|java\/|okhttp|httpie|libwww|lighthouse|screaming|semrush|ahrefs|serpstat/i;

// Favicon Tags para SEO
const BASE_URL = 'https://parametros.smartdent.com.br';

// ===== JSON-LD SAFETY =====
// Evita "Erro de análise" no GSC quando o conteúdo contém `<`, `>`, `&`
// ou (pior) a substring `</script>` que quebra o bloco JSON-LD inline.
// Sempre usar safeLd(obj) ao injetar JSON-LD em <script type="application/ld+json">.
function safeLd(obj: unknown): string {
  return JSON.stringify(obj)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

// Renderiza <link rel="alternate" hreflang> para um conjunto de URLs por idioma
function buildHreflang(urls: { pt: string; en?: string; es?: string }): string {
  const tags: string[] = [`<link rel="alternate" hreflang="pt-BR" href="${urls.pt}" />`];
  if (urls.en) tags.push(`<link rel="alternate" hreflang="en-US" href="${urls.en}" />`);
  if (urls.es) tags.push(`<link rel="alternate" hreflang="es-ES" href="${urls.es}" />`);
  tags.push(`<link rel="alternate" hreflang="x-default" href="${urls.pt}" />`);
  return tags.join('\n  ');
}

// Bloco de envio/devolução exigido pelo Google Merchant Listings (smartdent.com.br/BR)
function merchantOfferExtras() {
  return {
    hasMerchantReturnPolicy: {
      "@type": "MerchantReturnPolicy",
      applicableCountry: "BR",
      returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
      merchantReturnDays: 7,
      returnMethod: "https://schema.org/ReturnByMail",
      returnFees: "https://schema.org/FreeReturn"
    },
    shippingDetails: {
      "@type": "OfferShippingDetails",
      shippingRate: { "@type": "MonetaryAmount", value: "0", currency: "BRL" },
      shippingDestination: { "@type": "DefinedRegion", addressCountry: "BR" },
      deliveryTime: {
        "@type": "ShippingDeliveryTime",
        handlingTime: { "@type": "QuantitativeValue", minValue: 1, maxValue: 3, unitCode: "DAY" },
        transitTime:  { "@type": "QuantitativeValue", minValue: 2, maxValue: 7, unitCode: "DAY" }
      }
    }
  };
}

const FAVICON_TAGS = `
  <link rel="icon" type="image/x-icon" href="${BASE_URL}/favicon.ico?v=6">
  <link rel="icon" type="image/png" sizes="16x16" href="${BASE_URL}/favicon-16x16.png?v=6">
  <link rel="icon" type="image/png" sizes="32x32" href="${BASE_URL}/favicon-32x32.png?v=6">
  <link rel="icon" type="image/png" sizes="48x48" href="${BASE_URL}/favicon-48x48.png?v=6">
  <link rel="icon" type="image/png" sizes="192x192" href="${BASE_URL}/favicon-192x192.png?v=6">
  <link rel="icon" type="image/png" sizes="512x512" href="${BASE_URL}/favicon-512x512.png?v=6">
  <link rel="apple-touch-icon" sizes="180x180" href="${BASE_URL}/apple-touch-icon.png?v=6">
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect fill='%232463eb' width='32' height='32' rx='4'/><text x='50%25' y='50%25' fill='white' font-family='sans-serif' font-size='14' font-weight='bold' text-anchor='middle' dy='.35em'>SD</text></svg>">
`;

// ===== SHARED HELPERS: AI-Ready Semantic Structure =====

// Internal entity dictionary for entity index injection (static Wikidata-linked terms)
const ENTITY_INDEX: Record<string, { name: string; wikidata?: string; url?: string; description: string; aliases?: string[] }> = {
  IMPRESSAO_3D: { name: "Impressão 3D", wikidata: "https://www.wikidata.org/wiki/Q229367", description: "Fabricação aditiva por deposição camada a camada de material.", aliases: ["3D printing", "impresión 3D", "manufatura aditiva"] },
  CAD_CAM: { name: "CAD/CAM", wikidata: "https://www.wikidata.org/wiki/Q207696", description: "Projeto assistido por computador e manufatura assistida por computador.", aliases: ["computer-aided design"] },
  ODONTOLOGIA_DIGITAL: { name: "Odontologia Digital", wikidata: "https://www.wikidata.org/wiki/Q1023932", description: "Integração de tecnologias digitais no fluxo de trabalho odontológico.", aliases: ["digital dentistry"] },
  RESINA_COMPOSTA: { name: "Resina Composta", wikidata: "https://www.wikidata.org/wiki/Q1144215", description: "Material restaurador polimérico com partículas de carga inorgânica.", aliases: ["composite resin", "resina fotopolimerizável"] },
  ZIRCONIA: { name: "Zircônia", wikidata: "https://www.wikidata.org/wiki/Q81727", description: "Cerâmica de dióxido de zircônio utilizada em próteses dentárias.", aliases: ["zirconia", "ZrO2"] },
  FOTOPOLIMERIZACAO: { name: "Fotopolimerização", wikidata: "https://www.wikidata.org/wiki/Q899948", description: "Processo de polimerização iniciado por radiação luminosa.", aliases: ["photopolymerization", "cura UV", "light curing"] },
  DLP: { name: "DLP (Digital Light Processing)", wikidata: "https://www.wikidata.org/wiki/Q631962", description: "Tecnologia de impressão 3D por processamento digital de luz.", aliases: ["digital light processing"] },
  LCD_MSLA: { name: "LCD/mSLA", wikidata: "https://www.wikidata.org/wiki/Q229367", description: "Impressão 3D por fotopolimerização mascarada via painel LCD.", aliases: ["masked stereolithography"] },
  SLA: { name: "SLA (Estereolitografia)", wikidata: "https://www.wikidata.org/wiki/Q746381", description: "Tecnologia de impressão 3D por estereolitografia a laser.", aliases: ["stereolithography"] },
  PROTESE_DENTARIA: { name: "Prótese Dentária", wikidata: "https://www.wikidata.org/wiki/Q1397513", description: "Dispositivo artificial para substituição de dentes ausentes.", aliases: ["dental prosthesis", "prosthodontics"] },
  SCANNER_INTRAORAL: { name: "Scanner Intraoral", wikidata: "https://www.wikidata.org/wiki/Q1023932", description: "Dispositivo de escaneamento digital para captura de impressões dentárias.", aliases: ["intraoral scanner"] },
  GUIA_CIRURGICO: { name: "Guia Cirúrgico", wikidata: "https://www.wikidata.org/wiki/Q223809", description: "Dispositivo impresso em 3D para posicionamento preciso de implantes.", aliases: ["surgical guide"] },
};

function matchEntitiesInText(text: string): Array<{ id: string; name: string; wikidata?: string; description: string }> {
  const lowerText = text.toLowerCase();
  const matched: Array<{ id: string; name: string; wikidata?: string; description: string }> = [];
  const seen = new Set<string>();
  for (const [id, entity] of Object.entries(ENTITY_INDEX)) {
    if (seen.has(id)) continue;
    const terms = [entity.name, ...(entity.aliases || [])];
    for (const term of terms) {
      if (lowerText.includes(term.toLowerCase())) {
        matched.push({ id, name: entity.name, wikidata: entity.wikidata, description: entity.description });
        seen.add(id);
        break;
      }
    }
  }
  return matched;
}

function buildEntityIndexJsonLd(text: string, knowledgeCtx?: KnowledgeContext): string {
  // Combine static dictionary entities with dynamic DB entities
  const staticEntities = matchEntitiesInText(text);
  
  const about: Array<Record<string, string>> = [];
  const mentions: Array<Record<string, string>> = [];
  
  // Static entities first
  staticEntities.forEach((e, i) => {
    const item: Record<string, string> = { "@type": "DefinedTerm", "name": e.name, "description": e.description };
    if (e.wikidata) item.sameAs = e.wikidata;
    (i < 3 ? about : mentions).push(item);
  });
  
  // Dynamic entities from DB
  if (knowledgeCtx) {
    // Products as Product nodes
    knowledgeCtx.products.forEach(p => {
      mentions.push({ "@type": "Product", "name": p.name, "description": p.description || '', "url": `${BASE_URL}/produtos/${p.slug}` });
    });
    // Authors as Person nodes
    knowledgeCtx.authors.forEach(a => {
      mentions.push({ "@type": "Person", "name": a.name, "jobTitle": a.specialty || '', "description": a.mini_bio || '' });
    });
    // Articles as Article nodes
    knowledgeCtx.articles.forEach(a => {
      mentions.push({ "@type": "Article", "name": a.title, "url": `${BASE_URL}/base-conhecimento/${a.category_letter || 'a'}/${a.slug}` });
    });
    // External Links as WebPage nodes
    knowledgeCtx.externalLinks.forEach(l => {
      mentions.push({ "@type": "WebPage", "name": l.name, "url": l.url });
    });
  }
  
  if (about.length === 0 && mentions.length === 0) return '';
  
  const schema: Record<string, unknown> = { "@context": "https://schema.org" };
  if (about.length > 0) schema.about = about;
  if (mentions.length > 0) schema.mentions = mentions;
  return `<script type="application/ld+json">${safeLd(schema)}</script>`;
}

// ===== KNOWLEDGE CONTEXT: Dynamic data from system =====

interface KnowledgeContext {
  products: Array<{ name: string; slug: string; description?: string; image_url?: string; category?: string }>;
  categories: Array<{ id: string; name: string; letter: string }>;
  authors: Array<{ name: string; specialty?: string; mini_bio?: string; photo_url?: string }>;
  articles: Array<{ title: string; slug: string; excerpt?: string; category_letter?: string }>;
  testimonials: Array<{ name: string; description?: string; specialty?: string; rating?: number }>;
  externalLinks: Array<{ name: string; url: string; category?: string }>;
}

async function fetchKnowledgeContext(supabase: any, opts?: { categoryId?: string; limit?: number }): Promise<KnowledgeContext> {
  const limit = opts?.limit || 5;
  
  const [productsRes, categoriesRes, authorsRes, articlesRes, testimonialsRes, linksRes] = await Promise.all([
    supabase.from('system_a_catalog').select('name, slug, description, image_url, category').eq('active', true).eq('approved', true).eq('category', 'product').order('order_index').limit(limit),
    supabase.from('knowledge_categories').select('id, name, letter').eq('enabled', true).order('order_index'),
    supabase.from('authors').select('name, specialty, mini_bio, photo_url').eq('active', true).order('order_index').limit(limit),
    (() => {
      let q = supabase.from('knowledge_contents').select('title, slug, excerpt, category_id').eq('active', true).order('updated_at', { ascending: false }).limit(limit);
      if (opts?.categoryId) q = q.eq('category_id', opts.categoryId);
      return q;
    })(),
    supabase.from('system_a_catalog').select('name, description, extra_data, slug').eq('active', true).eq('approved', true).eq('category', 'video_testimonial').order('created_at', { ascending: false }).limit(3),
    supabase.from('external_links').select('name, url, category').eq('approved', true).order('relevance_score', { ascending: false }).limit(limit),
  ]);

  // Map articles to include category letter
  const cats = categoriesRes.data || [];
  const catMap = new Map(cats.map((c: any) => [c.id, c.letter]));
  const articles = (articlesRes.data || []).map((a: any) => ({
    ...a,
    category_letter: catMap.get(a.category_id) || 'a'
  }));

  return {
    products: productsRes.data || [],
    categories: cats,
    authors: authorsRes.data || [],
    articles,
    testimonials: (testimonialsRes.data || []).map((t: any) => ({
      name: t.name,
      description: t.description,
      specialty: t.extra_data?.specialty,
      rating: t.extra_data?.rating
    })),
    externalLinks: linksRes.data || [],
  };
}

// ===== NEW HELPERS: Knowledge Integration =====

function buildAICrawlerPolicy(): string {
  return `<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
  <meta name="ai-crawler-policy" content="allow: GPTBot, ClaudeBot, PerplexityBot, Google-Extended" />`;
}

function buildEntityReferenceMetas(knowledgeCtx: KnowledgeContext, pageEntity?: { type: string; name: string }): string {
  const metas: string[] = [];
  metas.push(`<meta name="entity:organization" content="Smart Dent" />`);
  if (pageEntity) {
    metas.push(`<meta name="entity:${pageEntity.type}" content="${escapeHtml(pageEntity.name)}" />`);
  }
  // Add top products
  knowledgeCtx.products.slice(0, 3).forEach(p => {
    metas.push(`<meta name="entity:product" content="${escapeHtml(p.name)}" />`);
  });
  // Add experts
  knowledgeCtx.authors.slice(0, 2).forEach(a => {
    metas.push(`<meta name="entity:expert" content="${escapeHtml(a.name)}" />`);
  });
  return metas.join('\n  ');
}

function buildKnowledgeNav(knowledgeCtx: KnowledgeContext): string {
  if (knowledgeCtx.categories.length === 0) return '';
  return `
    <nav aria-label="Categorias" data-section="knowledge-nav" style="margin-top:0.5rem;display:flex;flex-wrap:wrap;gap:0.5rem">
      ${knowledgeCtx.categories.map(c => 
        `<a href="/base-conhecimento/${c.letter.toLowerCase()}" style="color:#2563eb;text-decoration:none;font-size:0.8rem;padding:0.25rem 0.5rem;border:1px solid #e5e7eb;border-radius:4px">${c.letter} - ${escapeHtml(c.name)}</a>`
      ).join('')}
      <a href="/produtos" style="color:#2563eb;text-decoration:none;font-size:0.8rem;padding:0.25rem 0.5rem;border:1px solid #e5e7eb;border-radius:4px">Produtos</a>
    </nav>`;
}

function buildStandardHeaderWithNav(knowledgeCtx: KnowledgeContext): string {
  return `
  <a href="#main-content" class="skip-link" style="position:absolute;left:-9999px;top:auto;width:1px;height:1px;overflow:hidden;z-index:9999;padding:1rem 1.5rem;background:#2463eb;color:#fff;font-weight:600;text-decoration:none;border-radius:0 0 0.5rem 0">Pular para conteúdo principal</a>
  <style>.skip-link:focus{left:0;top:0;width:auto;height:auto;overflow:visible}</style>
  <header role="banner" style="${HEADER_STYLE}">
    <nav aria-label="Principal">
      <a href="https://smartdent.com.br" target="_blank" rel="noopener noreferrer" style="text-decoration:none;display:inline-flex;align-items:center;gap:0.75rem">
        <img src="${LOGO_URL}" alt="Smart Dent Logo" onerror="this.style.display='none'" style="height:48px;max-height:48px;width:auto;object-fit:contain" loading="eager" decoding="async" />
        <span style="color:#2563eb;font-size:1.5rem;font-weight:700">Smart Dent</span>
      </a>
    </nav>
    <p style="margin:0.5rem 0 0 0;font-size:0.875rem;color:#6b7280;font-weight:400">Parâmetros de Impressão 3D Odontológica</p>
    ${buildKnowledgeNav(knowledgeCtx)}
  </header>`;
}

function buildCitationBlocks(knowledgeCtx: KnowledgeContext): string {
  const testimonials = knowledgeCtx.testimonials.filter(t => t.description);
  if (testimonials.length === 0) return '';
  
  return `
    <section data-section="citations" class="llm-citation-layer" aria-label="Citações de Especialistas" style="margin:2rem 0;padding:1.5rem;background:#f8fafc;border-left:4px solid #2563eb;border-radius:0 8px 8px 0">
      <h2 style="font-size:1.1rem;margin:0 0 1rem 0;color:#1e3a5f">Depoimentos de Especialistas</h2>
      ${testimonials.slice(0, 3).map(t => `
        <blockquote cite="${BASE_URL}/depoimentos" data-expert="${escapeHtml(t.name)}" data-role="${escapeHtml(t.specialty || 'Especialista')}" style="margin:0.75rem 0;padding:0.75rem;background:#fff;border-radius:6px;font-style:italic;color:#374151">
          <p style="margin:0">"${escapeHtml((t.description || '').substring(0, 200))}"</p>
          <footer style="margin-top:0.5rem;font-style:normal;font-size:0.85rem;color:#6b7280">— <strong>${escapeHtml(t.name)}</strong>${t.specialty ? `, ${escapeHtml(t.specialty)}` : ''}${t.rating ? ` ⭐ ${t.rating}/5` : ''}</footer>
        </blockquote>
      `).join('')}
    </section>`;
}

function buildLLMKnowledgeLayer(entityName: string, entityCategory: string, knowledgeCtx: KnowledgeContext, extraFields?: Record<string, string>): string {
  const experts = knowledgeCtx.authors.map(a => a.name).join(', ');
  const products = knowledgeCtx.products.map(p => p.name).join(', ');
  const relatedArticles = knowledgeCtx.articles.map(a => a.title).join(', ');
  
  let dlItems = `
    <dt>Entity</dt><dd>${escapeHtml(entityName)}</dd>
    <dt>Category</dt><dd>${escapeHtml(entityCategory)}</dd>
    <dt>Organization</dt><dd>Smart Dent</dd>`;
  
  if (products) dlItems += `\n    <dt>Related Products</dt><dd>${escapeHtml(products)}</dd>`;
  if (experts) dlItems += `\n    <dt>Experts</dt><dd>${escapeHtml(experts)}</dd>`;
  if (relatedArticles) dlItems += `\n    <dt>Related Articles</dt><dd>${escapeHtml(relatedArticles)}</dd>`;
  
  if (extraFields) {
    for (const [key, value] of Object.entries(extraFields)) {
      dlItems += `\n    <dt>${escapeHtml(key)}</dt><dd>${escapeHtml(value)}</dd>`;
    }
  }
  
  return `
    <section data-section="knowledge-graph" class="llm-knowledge-layer" aria-label="Dados Estruturados para IA" style="position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden;">
      <dl>${dlItems}
      </dl>
    </section>`;
}

function buildEntityIndexSection(knowledgeCtx: KnowledgeContext): string {
  const hasProducts = knowledgeCtx.products.length > 0;
  const hasArticles = knowledgeCtx.articles.length > 0;
  const hasAuthors = knowledgeCtx.authors.length > 0;
  const hasExternalLinks = knowledgeCtx.externalLinks.length > 0;
  
  if (!hasProducts && !hasArticles && !hasAuthors && !hasExternalLinks) return '';
  
  return `
    <section data-section="entity-index" aria-label="Índice de Entidades" style="margin-top:2rem;padding:1.5rem;background:#f9fafb;border-radius:8px">
      <h2 style="font-size:1.1rem;margin:0 0 1rem 0">Entidades Relacionadas</h2>
      <nav>
        ${hasProducts ? `
        <h3 style="font-size:0.95rem;margin:0.75rem 0 0.25rem 0">Produtos</h3>
        <ul style="list-style:none;padding:0;margin:0">${knowledgeCtx.products.map(p => 
          `<li style="margin:0.25rem 0"><a href="/produtos/${p.slug}" style="color:#2563eb;text-decoration:none">${escapeHtml(p.name)}</a></li>`
        ).join('')}</ul>` : ''}
        ${hasArticles ? `
        <h3 style="font-size:0.95rem;margin:0.75rem 0 0.25rem 0">Artigos</h3>
        <ul style="list-style:none;padding:0;margin:0">${knowledgeCtx.articles.map(a => 
          `<li style="margin:0.25rem 0"><a href="/base-conhecimento/${a.category_letter || 'a'}/${a.slug}" style="color:#2563eb;text-decoration:none">${escapeHtml(a.title)}</a></li>`
        ).join('')}</ul>` : ''}
        ${hasAuthors ? `
        <h3 style="font-size:0.95rem;margin:0.75rem 0 0.25rem 0">Especialistas</h3>
        <ul style="list-style:none;padding:0;margin:0">${knowledgeCtx.authors.map(a => 
          `<li style="margin:0.25rem 0">${escapeHtml(a.name)}${a.specialty ? ` - <em>${escapeHtml(a.specialty)}</em>` : ''}</li>`
        ).join('')}</ul>` : ''}
        ${hasExternalLinks ? `
        <h3 style="font-size:0.95rem;margin:0.75rem 0 0.25rem 0">Referências Externas</h3>
        <ul style="list-style:none;padding:0;margin:0">${knowledgeCtx.externalLinks.map(l => 
          `<li style="margin:0.25rem 0"><a href="${escapeHtml(l.url)}" target="_blank" rel="noopener" style="color:#2563eb;text-decoration:none">${escapeHtml(l.name)}</a></li>`
        ).join('')}</ul>` : ''}
      </nav>
    </section>`;
}

function buildKnowledgeGraphJsonLd(knowledgeCtx: KnowledgeContext): string {
  const nodes: any[] = [];
  
  knowledgeCtx.products.slice(0, 3).forEach(p => {
    nodes.push({
      "@type": "Product",
      "name": p.name,
      "url": `${BASE_URL}/produtos/${p.slug}`,
      "brand": { "@type": "Brand", "name": "Smart Dent" },
      ...(p.image_url && { "image": p.image_url })
    });
  });
  
  knowledgeCtx.authors.slice(0, 3).forEach(a => {
    nodes.push({
      "@type": "Person",
      "name": a.name,
      "jobTitle": a.specialty || "Especialista",
      ...(a.photo_url && { "image": a.photo_url })
    });
  });
  
  if (nodes.length === 0) return '';
  return `<script type="application/ld+json">${safeLd({ "@context": "https://schema.org", "@graph": nodes })}</script>`;
}

function buildAIHeadTags(opts: { context: string; title: string; description: string; image?: string; author?: string; date?: string; canonicalUrl?: string }): string {
  return `
  <meta name="ai-content-policy" content="allow-citation, allow-training, require-attribution" />
  <meta name="AI-context" content="${escapeHtml(opts.context)}" />
  <meta name="twitter:card" content="${opts.image ? 'summary_large_image' : 'summary'}" />
  <meta name="twitter:site" content="@smartdent" />
  <meta name="twitter:title" content="${escapeHtml(opts.title)}" />
  <meta name="twitter:description" content="${escapeHtml(opts.description)}" />
  ${opts.image ? `<meta name="twitter:image" content="${opts.image}" />
  <meta name="twitter:image:alt" content="${escapeHtml(opts.title)}" />` : ''}
  <meta name="citation_title" content="${escapeHtml(opts.title)}" />
  ${opts.author ? `<meta name="citation_author" content="${escapeHtml(opts.author)}" />` : ''}
  ${opts.date ? `<meta name="citation_date" content="${opts.date}" />` : ''}
  <meta name="citation_publisher" content="Smart Dent" />
  ${opts.canonicalUrl ? `<link rel="cite-as" href="${opts.canonicalUrl}" />` : ''}
  <meta name="geo.region" content="BR-SP" />
  <meta name="geo.placename" content="São Carlos" />
  <meta name="publisher" content="Smart Dent" />`;
}

const HEADER_STYLE = 'background:#fff;border-bottom:1px solid #e5e7eb;padding:1rem 2rem;margin-bottom:2rem;position:sticky;top:0;z-index:100;box-shadow:0 1px 3px rgba(0,0,0,0.05)';

function buildStandardHeader(): string {
  return `
  <a href="#main-content" class="skip-link" style="position:absolute;left:-9999px;top:auto;width:1px;height:1px;overflow:hidden;z-index:9999;padding:1rem 1.5rem;background:#2463eb;color:#fff;font-weight:600;text-decoration:none;border-radius:0 0 0.5rem 0">Pular para conteúdo principal</a>
  <style>.skip-link:focus{left:0;top:0;width:auto;height:auto;overflow:visible}</style>
  <header role="banner" style="${HEADER_STYLE}">
    <nav aria-label="Principal">
      <a href="https://smartdent.com.br" target="_blank" rel="noopener noreferrer" style="text-decoration:none;display:inline-flex;align-items:center;gap:0.75rem">
        <img src="${LOGO_URL}" alt="Smart Dent Logo" onerror="this.style.display='none'" style="height:48px;max-height:48px;width:auto;object-fit:contain" loading="eager" decoding="async" />
        <span style="color:#2563eb;font-size:1.5rem;font-weight:700">Smart Dent</span>
      </a>
    </nav>
    <p style="margin:0.5rem 0 0 0;font-size:0.875rem;color:#6b7280;font-weight:400">Parâmetros de Impressão 3D Odontológica</p>
  </header>`;
}

function buildStandardFooter(): string {
  return `
  <footer role="contentinfo" style="border-top:1px solid #e5e7eb;padding:2rem;text-align:center;color:#6b7280;font-size:0.875rem;margin-top:2rem">
    <p>&copy; ${new Date().getFullYear()} Smart Dent - Todos os direitos reservados</p>
    <nav aria-label="Footer">
      <a href="https://smartdent.com.br" target="_blank" rel="noopener" style="color:#2563eb">smartdent.com.br</a> |
      <a href="${BASE_URL}/base-conhecimento" style="color:#2563eb">Base de Conhecimento</a> |
      <a href="${BASE_URL}/sobre" style="color:#2563eb">Sobre</a>
    </nav>
  </footer>`;
}

function buildBotRedirectScript(targetPath: string): string {
  return `<script>
  (function() {
    var ua = navigator.userAgent.toLowerCase();
    var isBot = /bot|crawler|spider|googlebot|bingbot|slurp|facebook|twitter|whatsapp/i.test(ua);
    if (!isBot && !navigator.webdriver) {
      window.location.href = "${targetPath}";
    }
  })();
  </script>`;
}

function buildAISummaryBlock(summary: string): string {
  return `<section data-section="summary" class="llm-knowledge-layer" aria-label="Resumo para IA">
        <div class="ai-citation-box" itemProp="abstract">
          <p class="article-summary">${escapeHtml(summary)}</p>
        </div>
      </section>`;
}

const isBot = (ua: string): boolean => {
  if (!ua) return false;
  const lowerUa = ua.toLowerCase();
  if (ALL_BOTS.some(bot => lowerUa.includes(bot))) return true;
  return BOT_HEURISTIC.test(lowerUa);
};

// ===== ADVANCED SEO SCHEMAS - FASE AUDITORIA =====

// Tipo de conteúdo baseado em categoria/keywords (para schemas médicos/científicos)
function detectContentType(content: any): 'MedicalWebPage' | 'ScholarlyArticle' | 'TechArticle' {
  const category = content.knowledge_categories?.name?.toLowerCase() || '';
  const keywords = (content.keywords || []).join(' ').toLowerCase();
  const title = (content.title || '').toLowerCase();
  const combinedText = `${keywords} ${title} ${category}`;
  
  // ===== MedicalWebPage: Conteúdo médico/odontológico =====
  const medicalKeywords = [
    // Biocompatibilidade e segurança
    'biocompatib', 'citotox', 'segurança biológica', 'iso 10993',
    // Regulamentação
    'anvisa', 'dispositivos médicos', 
    // Procedimentos clínicos odontológicos
    'lesões cervicais', 'lesão cervical', 'lcnc',
    'restauração classe', 'restaurações classe', 
    'odontologia restauradora', 'dentística',
    'restaurações dentárias', 'restauração dentária',
    'protocolo restaurador', 'abfração',
    // Tecidos bucais
    'esmalte dentário', 'adesão dentina', 'dentina',
    'abrasão dental', 'desgaste dental',
    // Materiais médicos
    'resina biocompatível', 'materiais odontológicos',
    // Especialidades
    'ortodontia', 'implantodontia', 'prótese dentária',
    'endodontia', 'periodontia'
  ];
  
  const isMedical = medicalKeywords.some(kw => combinedText.includes(kw));
  if (isMedical) {
    return 'MedicalWebPage';
  }
  
  // ===== ScholarlyArticle: Laudos e documentos técnicos =====
  const scholarlyKeywords = [
    'laudo', 'certificado', 'ensaio clínico', 
    'pesquisa', 'estudo científico', 'teste de',
    'relatório técnico', 'análise laboratorial'
  ];
  
  const isScholarly = scholarlyKeywords.some(kw => combinedText.includes(kw));
  if (isScholarly) {
    return 'ScholarlyArticle';
  }
  
  return 'TechArticle';
}

// Buscar reviews da empresa (Places API → system_a_catalog.extra_data.reviews_reputation)
async function fetchCompanyReviews(supabase: any): Promise<{
  rating: number;
  reviewCount: number;
  reviews: Array<{ author_name: string; rating: number; text: string; time: number; profile_photo_url?: string }>;
}> {
  try {
    const { data } = await supabase
      .from('system_a_catalog')
      .select('extra_data')
      .eq('category', 'company_info')
      .eq('active', true)
      .limit(1)
      .maybeSingle();
    const rep = (data as any)?.extra_data?.reviews_reputation;
    return {
      rating: Number(rep?.google_rating ?? 5),
      reviewCount: Number(rep?.google_review_count ?? 0),
      reviews: Array.isArray(rep?.google_reviews_pt) ? rep.google_reviews_pt : [],
    };
  } catch (e) {
    console.error('fetchCompanyReviews error:', (e as Error).message);
    return { rating: 5, reviewCount: 0, reviews: [] };
  }
}

// Publisher Schema completo com dados corporativos (FONTE DA VERDADE — Smart Dent / MMTech)
function buildPublisherSchema(baseUrl: string, companyReviews?: {
  rating: number;
  reviewCount: number;
  reviews: Array<{ author_name: string; rating: number; text: string; time: number; profile_photo_url?: string }>;
}) {
  const schema: any = {
    "@type": ["Organization", "Corporation"],
    "@id": `${baseUrl}/#organization`,
    "name": "Smart Dent",
    "legalName": "MMTech Projetos Tecnológicos Importação e Exportação Ltda.",
    "alternateName": ["Smart Dent Odontologia Digital", "MMTech"],
    "taxID": "10.736.894/0001-36",
    "vatID": "10.736.894/0001-36",
    "url": baseUrl,
    "logo": {
      "@type": "ImageObject",
      "url": LOGO_URL,
      "width": 512,
      "height": 512
    },
    "foundingDate": "2009",
    "numberOfEmployees": {
      "@type": "QuantitativeValue",
      "value": 40,
      "unitText": "employees"
    },
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "Rua Doutor Procópio de Toledo Malta, 62 — Morada dos Deuses",
      "addressLocality": "São Carlos",
      "addressRegion": "SP",
      "postalCode": "13562-291",
      "addressCountry": "BR"
    },
    "contactPoint": [
      {
        "@type": "ContactPoint",
        "telephone": "+55-16-3419-4735",
        "contactType": "customer service",
        "areaServed": "BR",
        "availableLanguage": ["Portuguese", "English", "Spanish"]
      },
      {
        "@type": "ContactPoint",
        "telephone": "+1-704-755-6220",
        "contactType": "customer service",
        "areaServed": "US",
        "availableLanguage": ["English", "Portuguese"]
      }
    ],
    "sameAs": [
      "https://www.instagram.com/smartdentbr/",
      "https://www.youtube.com/@smartdentbr",
      "https://www.facebook.com/smartdent.br/",
      "https://www.linkedin.com/company/smartdent-brasil/",
      "https://www.smartdent.com.br",
      "https://smartdentusa.com",
      "https://loja.smartdent.com.br",
      "https://parametros.smartdent.com.br"
    ],
    "expertise": "Desenvolvimento e fabricação de resinas odontológicas para impressão 3D, equipamentos CAD/CAM e fluxos digitais completos para odontologia",
    "knowsAbout": [
      "Impressão 3D odontológica",
      "Resinas fotopolimerizáveis (DLP/LCD)",
      "Biocompatibilidade dental",
      "Prótese dentária digital",
      "Ortodontia digital",
      "CAD/CAM odontológico",
      "Escaneamento intraoral",
      "Discos CoCr para próteses",
      "Zircônia Y-TZP"
    ],
    "award": [
      "Certificação ISO 13485 - Dispositivos Médicos",
      "Registro ANVISA para resinas odontológicas",
      "FAPESP PIPE 2016/21568-3 — Resina Smart Print",
      "FAPESP PIPE Fase 3 — Discos CoCr CAD-CAM",
      "CNPq 300245/2013 — Zircônia Y-TZP odontológica"
    ],
    // Entidade controladora americana (parent organization)
    "parentOrganization": {
      "@type": "Organization",
      "@id": `${baseUrl}/#organization-us`,
      "name": "MMTech North America LLC",
      "alternateName": "Smart Dent USA",
      "url": "https://smartdentusa.com",
      "foundingDate": "2022-06-29",
      "identifier": [
        { "@type": "PropertyValue", "propertyID": "NC-SOS-File-Number", "value": "2444464" }
      ],
      "address": {
        "@type": "PostalAddress",
        "streetAddress": "10800 Sikes Place, Suite 230",
        "addressLocality": "Charlotte",
        "addressRegion": "NC",
        "postalCode": "28277-8130",
        "addressCountry": "US"
      },
      "telephone": "+1-704-755-6220",
      "memberOf": {
        "@type": "Organization",
        "name": "UNC Charlotte University Business Partner",
        "url": "https://www.charlotte.edu/"
      }
    },
    // Fundadores como Person Schema completo (E-E-A-T máximo para Google e LLMs)
    "founder": [
      {
        "@type": "Person",
        "@id": `${baseUrl}/#founder-del-guerra`,
        "name": "Marcelo Del Guerra",
        "honorificPrefix": "Dr.",
        "honorificSuffix": "PhD",
        "jobTitle": "Sócio Diretor / Manager",
        "identifier": [
          { "@type": "PropertyValue", "propertyID": "ORCID", "value": "0000-0003-1537-3742" },
          { "@type": "PropertyValue", "propertyID": "Lattes", "value": "8426583815730831" }
        ],
        "sameAs": [
          "https://orcid.org/0000-0003-1537-3742",
          "http://lattes.cnpq.br/8426583815730831",
          "https://bv.fapesp.br/pt/pesquisador/1694/marcelo-del-guerra/"
        ],
        "alumniOf": [
          { "@type": "CollegeOrUniversity", "name": "Escola de Engenharia de São Carlos - USP (EESC-USP)" }
        ],
        "hasCredential": [
          { "@type": "EducationalOccupationalCredential", "credentialCategory": "degree", "educationalLevel": "PhD", "about": "Engenharia de Produção Mecânica" },
          { "@type": "EducationalOccupationalCredential", "credentialCategory": "degree", "educationalLevel": "Master", "about": "Manufatura" },
          { "@type": "EducationalOccupationalCredential", "credentialCategory": "degree", "educationalLevel": "Bachelor", "about": "Engenharia Mecatrônica" }
        ],
        "knowsAbout": ["CAD/CAM", "Impressão 3D Odontológica", "Manufatura Avançada", "Metrologia", "Resinas DLP"],
        "memberOf": {
          "@type": "Organization",
          "name": "CNPq - Conselho Nacional de Desenvolvimento Científico e Tecnológico"
        }
      },
      {
        "@type": "Person",
        "@id": `${baseUrl}/#founder-cestari`,
        "name": "Marcelo Cestari",
        "honorificSuffix": "MSc",
        "jobTitle": "Diretor Químico / Manager",
        "identifier": [
          { "@type": "PropertyValue", "propertyID": "ORCID", "value": "0000-0002-1985-209X" },
          { "@type": "PropertyValue", "propertyID": "Lattes", "value": "4312984371086446" }
        ],
        "sameAs": [
          "https://orcid.org/0000-0002-1985-209X",
          "http://lattes.cnpq.br/4312984371086446"
        ],
        "alumniOf": [
          { "@type": "CollegeOrUniversity", "name": "Universidade Federal de São Carlos (UFSCar)" },
          { "@type": "CollegeOrUniversity", "name": "Universidade de São Paulo (USP)" }
        ],
        "hasCredential": [
          { "@type": "EducationalOccupationalCredential", "credentialCategory": "degree", "educationalLevel": "Master", "about": "Ciência e Engenharia de Materiais" },
          { "@type": "EducationalOccupationalCredential", "credentialCategory": "degree", "educationalLevel": "Bachelor", "about": "Química" }
        ],
        "knowsAbout": ["Polímeros", "PVDF", "Resinas Odontológicas", "Próteses de Alta Performance", "Engenharia de Materiais"]
      }
    ],
    // Responsável Técnico (CRO-SP — exigência ANVISA para dispositivos médicos)
    "employee": [
      {
        "@type": "Person",
        "name": "Ricardo Casale",
        "jobTitle": "Responsável Técnico",
        "identifier": [
          { "@type": "PropertyValue", "propertyID": "CRO-SP", "value": "78005" }
        ]
      }
    ]
  };

  if (companyReviews && companyReviews.reviewCount > 0) {
    schema.aggregateRating = {
      "@type": "AggregateRating",
      "ratingValue": String(companyReviews.rating),
      "reviewCount": String(companyReviews.reviewCount),
      "bestRating": "5",
      "worstRating": "1"
    };
    if (companyReviews.reviews.length > 0) {
      schema.review = companyReviews.reviews.slice(0, 5).map((r) => ({
        "@type": "Review",
        "author": { "@type": "Person", "name": r.author_name },
        "reviewRating": {
          "@type": "Rating",
          "ratingValue": String(r.rating),
          "bestRating": "5",
          "worstRating": "1"
        },
        "reviewBody": r.text,
        "datePublished": r.time ? new Date(r.time * 1000).toISOString().split('T')[0] : undefined
      }));
    }
  }

  return schema;
}

// Author Schema completo com credenciais profissionais (E-E-A-T)
function buildAuthorSchema(author: any, baseUrl: string) {
  if (!author) {
    return {
      "@type": "Organization",
      "@id": `${baseUrl}/#organization`,
      "name": "Smart Dent"
    };
  }

  const authorSlug = (author.name || '').toLowerCase().replace(/\s+/g, '-').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  const socialLinks = [
    author.lattes_url,
    author.linkedin_url,
    author.instagram_url,
    author.youtube_url,
    author.facebook_url,
    author.twitter_url,
    author.tiktok_url,
    author.website_url
  ].filter(Boolean);

  const schema: any = {
    "@type": "Person",
    "@id": `${baseUrl}/#author-${authorSlug}`,
    "name": author.name,
    "url": author.website_url || `${baseUrl}/autores/${authorSlug}`,
    "image": author.photo_url,
    "jobTitle": author.specialty,
    "description": author.mini_bio,
    "sameAs": socialLinks
  };

  // Adicionar credenciais se disponível (do mini_bio)
  if (author.mini_bio) {
    const bio = author.mini_bio.toLowerCase();
    
    // Detectar formação acadêmica
    if (bio.includes('doutor') || bio.includes('phd') || bio.includes('doutorado')) {
      schema.hasCredential = schema.hasCredential || [];
      schema.hasCredential.push({
        "@type": "EducationalOccupationalCredential",
        "credentialCategory": "degree",
        "educationalLevel": "Doctoral"
      });
    }
    if (bio.includes('mestre') || bio.includes('mestrado') || bio.includes('msc')) {
      schema.hasCredential = schema.hasCredential || [];
      schema.hasCredential.push({
        "@type": "EducationalOccupationalCredential",
        "credentialCategory": "degree",
        "educationalLevel": "Master"
      });
    }
    
    // Detectar universidades brasileiras conhecidas
    const universities = [];
    if (bio.includes('usp') || bio.includes('são paulo')) {
      universities.push({ "@type": "CollegeOrUniversity", "name": "Universidade de São Paulo (USP)" });
    }
    if (bio.includes('unicamp') || bio.includes('campinas')) {
      universities.push({ "@type": "CollegeOrUniversity", "name": "Universidade Estadual de Campinas (UNICAMP)" });
    }
    if (bio.includes('unesp')) {
      universities.push({ "@type": "CollegeOrUniversity", "name": "Universidade Estadual Paulista (UNESP)" });
    }
    if (bio.includes('ufrj') || bio.includes('federal do rio')) {
      universities.push({ "@type": "CollegeOrUniversity", "name": "Universidade Federal do Rio de Janeiro (UFRJ)" });
    }
    if (universities.length > 0) {
      schema.alumniOf = universities;
    }
    
    // Detectar áreas de conhecimento
    const knowsAbout = [];
    if (bio.includes('impressão 3d') || bio.includes('impressora')) knowsAbout.push('Impressão 3D');
    if (bio.includes('cad') || bio.includes('cam')) knowsAbout.push('CAD/CAM');
    if (bio.includes('prótese') || bio.includes('protese')) knowsAbout.push('Prótese Dentária');
    if (bio.includes('ortodon')) knowsAbout.push('Ortodontia');
    if (bio.includes('resina')) knowsAbout.push('Resinas Odontológicas');
    if (bio.includes('metrologia') || bio.includes('precisão')) knowsAbout.push('Metrologia');
    if (knowsAbout.length > 0) {
      schema.knowsAbout = knowsAbout;
    }
  }

  // Adicionar Lattes como credencial CNPq
  if (author.lattes_url) {
    schema.memberOf = {
      "@type": "Organization",
      "name": "CNPq - Conselho Nacional de Desenvolvimento Científico e Tecnológico",
      "url": "https://lattes.cnpq.br/"
    };
  }

  return schema;
}

// MedicalWebPage Schema para conteúdo de saúde
function buildMedicalWebPageSchema(content: any, author: any, baseUrl: string, canonicalUrl: string) {
  return {
    "@type": "MedicalWebPage",
    "@id": canonicalUrl,
    "name": content.title,
    "headline": content.title,
    "description": content.excerpt || content.meta_description,
    "datePublished": content.created_at,
    "dateModified": content.updated_at,
    "image": content.og_image_url || content.content_image_url,
    "url": canonicalUrl,
    "inLanguage": "pt-BR",
    "specialty": {
      "@type": "MedicalSpecialty",
      "name": "Odontologia"
    },
    "medicalAudience": {
      "@type": "MedicalAudience",
      "audienceType": "Clinician",
      "geographicArea": { "@type": "Country", "name": "Brasil" }
    },
    "lastReviewed": content.updated_at,
    "reviewedBy": buildAuthorSchema(author, baseUrl),
    "author": { "@id": buildAuthorSchema(author, baseUrl)["@id"] },
    "publisher": { "@id": `${baseUrl}/#organization` },
    "about": {
      "@type": "MedicalEntity",
      "name": content.knowledge_categories?.name || "Odontologia Digital",
      "relevantSpecialty": {
        "@type": "MedicalSpecialty",
        "name": "Odontologia"
      }
    },
    "mainContentOfPage": {
      "@type": "WebPageElement",
      "cssSelector": "article"
    }
  };
}

// ScholarlyArticle Schema para laudos e documentos técnicos
function buildScholarlyArticleSchema(content: any, author: any, baseUrl: string, canonicalUrl: string) {
  return {
    "@type": "ScholarlyArticle",
    "@id": canonicalUrl,
    "headline": content.title,
    "name": content.title,
    "abstract": content.excerpt || content.meta_description,
    "description": content.excerpt || content.meta_description,
    "datePublished": content.created_at,
    "dateModified": content.updated_at,
    "image": content.og_image_url || content.content_image_url,
    "url": canonicalUrl,
    "inLanguage": "pt-BR",
    "author": buildAuthorSchema(author, baseUrl),
    "publisher": { "@id": `${baseUrl}/#organization` },
    "isAccessibleForFree": true,
    "keywords": content.keywords?.join(', '),
    "articleSection": content.knowledge_categories?.name || "Documentação Técnica",
    "backstory": "Documento técnico-científico baseado em ensaios laboratoriais e normas internacionais (ISO, ANVISA).",
    "citation": content.file_url ? `Documento disponível em: ${content.file_url}` : undefined,
    "copyrightHolder": { "@id": `${baseUrl}/#organization` },
    "copyrightYear": new Date(content.created_at).getFullYear()
  };
}

function generate404(): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <title>Página não encontrada | Smart Dent</title>
  <meta name="robots" content="noindex" />
  ${FAVICON_TAGS}
  ${buildGTMHead()}
</head>
<body>
  ${buildGTMBody()}
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

// ===== GTM TRACKING PIXELS =====
const GTM_CONTAINER_ID = 'GTM-NZ64Q899';

function buildGTMHead(): string {
  return `<!-- Google Tag Manager -->
  <script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
  new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
  j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
  'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
  })(window,document,'script','dataLayer','${GTM_CONTAINER_ID}');</script>
  <!-- End Google Tag Manager -->`;
}

function buildGTMBody(): string {
  return `<!-- Google Tag Manager (noscript) -->
  <noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${GTM_CONTAINER_ID}"
  height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
  <!-- End Google Tag Manager (noscript) -->`;
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
  const [brandsRes, knowledgeCtx] = await Promise.all([
    supabase.from('brands').select('name, slug, logo_url').eq('active', true).order('name').limit(20),
    fetchKnowledgeContext(supabase),
  ]);

  const brands = brandsRes.data;
  if (brandsRes.error) {
    console.error('Supabase error fetching brands:', brandsRes.error.message);
  }

  const baseUrl = 'https://parametros.smartdent.com.br';
  const title = 'Parâmetros de Impressão 3D Odontológica | Smart Dent';
  const description = `Base de dados profissional com parâmetros testados para ${brands?.length || 15}+ marcas de impressoras 3D odontológicas. Elegoo, Anycubic, Creality e mais.`;
  const contextText = `Base de dados profissional de parâmetros de impressão 3D odontológica com ${brands?.length || 15}+ marcas. Público-alvo: cirurgiões-dentistas e técnicos em prótese dentária.`;
  const entityText = `Impressão 3D odontológica parâmetros resina fotopolimerização DLP LCD/mSLA SLA CAD/CAM scanner intraoral prótese dentária guia cirúrgico odontologia digital`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  ${FAVICON_TAGS}
  ${buildAICrawlerPolicy()}
  ${buildEntityReferenceMetas(knowledgeCtx, { type: 'technology', name: 'Impressão 3D Odontológica' })}
  <link rel="canonical" href="${baseUrl}/" />
  ${buildHreflang({ pt: `${baseUrl}/`, en: `${baseUrl}/en`, es: `${baseUrl}/es` })}
  <meta property="og:title" content="Hub de Fluxo Digital e Parâmetros 3D | Smart Dent" />
  <meta property="og:description" content="Domine o fluxo digital odontológico: de parâmetros de impressão validados a estratégias de escaneamento e design." />
  <meta property="og:image" content="${baseUrl}/og-fluxo-digital.jpg" />
  <meta property="og:type" content="website" />
  ${buildAIHeadTags({ context: contextText, title, description, image: `${baseUrl}/og-fluxo-digital.jpg`, canonicalUrl: `${baseUrl}/` })}
  <script type="application/ld+json">
  ${safeLd({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "name": "Smart Dent - Parâmetros de Impressão 3D",
        "url": baseUrl,
        "description": "Base de dados profissional com parâmetros testados",
        "potentialAction": {
          "@type": "SearchAction",
          "target": `${baseUrl}/?search={search_term_string}`,
          "query-input": "required name=search_term_string"
        }
      },
      {
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Início", "item": baseUrl }
        ]
      }
    ]
  })}
  </script>
  ${buildEntityIndexJsonLd(entityText, knowledgeCtx)}
  ${buildKnowledgeGraphJsonLd(knowledgeCtx)}
  ${buildGTMHead()}
</head>
<body>
  ${buildGTMBody()}
  ${buildStandardHeaderWithNav(knowledgeCtx)}
  <main id="main-content">
    <article>
      <h1>Parâmetros de Impressão 3D Odontológica</h1>
      ${buildAISummaryBlock(contextText)}
      <p data-section="definition">Plataforma de referência com configurações validadas para impressoras 3D odontológicas. Parâmetros profissionais testados para uso clínico em odontologia digital, incluindo resinas fotopolimerizáveis para guias cirúrgicos, modelos de estudo, próteses provisórias e alinhadores ortodônticos.</p>
      <h2>Marcas Disponíveis</h2>
      <ul>
        ${brands?.map((b: any) => `<li><a href="/${b.slug}">${b.name}</a></li>`).join('') || ''}
      </ul>
      ${buildCitationBlocks(knowledgeCtx)}
      ${buildLLMKnowledgeLayer('Parâmetros de Impressão 3D', 'Plataforma de Referência', knowledgeCtx, { 'Technology': 'Impressão 3D LCD, DLP, SLA', 'Applications': 'modelos dentários, guias cirúrgicos, próteses provisórias, alinhadores' })}
      ${buildEntityIndexSection(knowledgeCtx)}
    </article>
  </main>
  ${buildStandardFooter()}
  ${buildBotRedirectScript('/')}
</body>
</html>`;
}

async function generateBrandHTML(brandSlug: string, supabase: any): Promise<string> {
  const [brandRes, knowledgeCtx] = await Promise.all([
    supabase.from('brands').select('*, models(name, slug, image_url)').eq('slug', brandSlug).eq('active', true).single(),
    fetchKnowledgeContext(supabase, { limit: 3 }),
  ]);

  if (brandRes.error) {
    console.error('Supabase error fetching brand:', brandSlug, brandRes.error.message);
    return '';
  }
  const brand = brandRes.data;
  if (!brand) return '';

  const modelsCount = brand.models?.length || 0;
  const baseUrl = 'https://parametros.smartdent.com.br';
  const title = `${escapeHtml(brand.name)} - Parâmetros de Impressão 3D | Smart Dent`;
  const description = `Configurações profissionais para impressoras 3D ${escapeHtml(brand.name)}. ${modelsCount} modelos disponíveis com parâmetros testados.`;
  const contextText = `Parâmetros de impressão 3D profissional para impressoras ${escapeHtml(brand.name)}. ${modelsCount} modelos com configurações testadas para uso odontológico.`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <meta name="description" content="${description}" />
  ${FAVICON_TAGS}
  ${buildAICrawlerPolicy()}
  ${buildEntityReferenceMetas(knowledgeCtx, { type: 'brand', name: brand.name })}
  <link rel="canonical" href="${baseUrl}/${brandSlug}" />
  ${buildHreflang({ pt: `${baseUrl}/${brandSlug}` })}
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="Configurações para ${modelsCount} modelos ${escapeHtml(brand.name)}" />
  <meta property="og:image" content="${brand.logo_url || `${baseUrl}/og-fluxo-digital.jpg`}" />
  <meta property="og:type" content="website" />
  ${buildAIHeadTags({ context: contextText, title, description, image: brand.logo_url || `${baseUrl}/og-fluxo-digital.jpg`, canonicalUrl: `${baseUrl}/${brandSlug}` })}
  <script type="application/ld+json">
  ${safeLd({
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Organization", "name": escapeHtml(brand.name), "url": `${baseUrl}/${brandSlug}`, "logo": brand.logo_url },
      { "@type": "BreadcrumbList", "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Início", "item": baseUrl },
        { "@type": "ListItem", "position": 2, "name": escapeHtml(brand.name), "item": `${baseUrl}/${brandSlug}` }
      ]}
    ]
  })}
  </script>
  ${buildEntityIndexJsonLd(`Impressora 3D ${brand.name} impressão 3D odontológica resina fotopolimerização DLP LCD/mSLA`, knowledgeCtx)}
  ${buildKnowledgeGraphJsonLd(knowledgeCtx)}
  ${buildGTMHead()}
</head>
<body>
  ${buildGTMBody()}
  ${buildStandardHeaderWithNav(knowledgeCtx)}
  <main id="main-content">
    <article>
      <h1>Impressoras 3D ${escapeHtml(brand.name)}</h1>
      ${buildAISummaryBlock(contextText)}
      <p data-section="definition">Parâmetros profissionais testados e validados para ${modelsCount} modelos de impressoras 3D ${escapeHtml(brand.name)}, otimizados para uso clínico em odontologia digital com resinas fotopolimerizáveis Smart Dent.</p>
      <h2>Modelos Disponíveis (${modelsCount})</h2>
      <ul>
        ${brand.models?.map((m: any) => `<li><a href="/${brandSlug}/${m.slug}">${m.name}</a></li>`).join('') || ''}
      </ul>
      ${buildLLMKnowledgeLayer(brand.name, 'Marca de Impressoras 3D', knowledgeCtx)}
      ${buildEntityIndexSection(knowledgeCtx)}
    </article>
  </main>
  ${buildStandardFooter()}
  ${buildBotRedirectScript(`/${brandSlug}`)}
</body>
</html>`;
}

async function generateModelHTML(brandSlug: string, modelSlug: string, supabase: any): Promise<string> {
  const [modelRes, resinsRes, knowledgeCtx] = await Promise.all([
    supabase.from('models').select('*, brands!inner(*)').eq('slug', modelSlug).eq('brands.slug', brandSlug).eq('active', true).single(),
    supabase.from('parameter_sets').select('resin_name, resin_manufacturer').eq('brand_slug', brandSlug).eq('model_slug', modelSlug).eq('active', true),
    fetchKnowledgeContext(supabase, { limit: 3 }),
  ]);

  if (modelRes.error) {
    console.error('Supabase error fetching model:', modelSlug, modelRes.error.message);
    return '';
  }
  const model = modelRes.data;
  if (!model) { console.log('Model not found:', modelSlug); return ''; }

  if (resinsRes.error) {
    console.error('Supabase error fetching resins:', resinsRes.error.message);
  }

  const uniqueResins = [...new Map((resinsRes.data || []).map((r: any) => 
    [`${r.resin_manufacturer}-${r.resin_name}`, r]
  )).values()];

  const resinsCount = uniqueResins.length;
  const baseUrl = 'https://parametros.smartdent.com.br';
  const title = `${escapeHtml(model.name)} - Parâmetros de Impressão 3D | Smart Dent`;
  const description = `Parâmetros profissionais para ${escapeHtml(model.name)}. ${resinsCount} resinas disponíveis com configurações testadas.`;
  const contextText = `Parâmetros de impressão 3D para ${escapeHtml(model.name)} (${escapeHtml((model.brands as any).name)}). ${resinsCount} resinas com configurações testadas para odontologia digital.`;
  const ogImage = model.image_url || `${baseUrl}/og-fluxo-digital.jpg`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <meta name="description" content="${description}" />
  ${FAVICON_TAGS}
  ${buildAICrawlerPolicy()}
  ${buildEntityReferenceMetas(knowledgeCtx, { type: 'product', name: model.name })}
  <link rel="canonical" href="${baseUrl}/${brandSlug}/${modelSlug}" />
  ${buildHreflang({ pt: `${baseUrl}/${brandSlug}/${modelSlug}` })}
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${resinsCount} resinas disponíveis para ${escapeHtml(model.name)}" />
  <meta property="og:image" content="${ogImage}" />
  <meta property="og:type" content="product" />
  ${buildAIHeadTags({ context: contextText, title, description, image: ogImage, canonicalUrl: `${baseUrl}/${brandSlug}/${modelSlug}` })}
  <script type="application/ld+json">
  ${safeLd({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Product",
        "name": escapeHtml(model.name),
        "description": escapeHtml(model.notes) || `Impressora 3D ${escapeHtml(model.name)}`,
        "brand": { "@type": "Brand", "name": escapeHtml((model.brands as any).name) },
        "image": model.image_url,
        "url": `${baseUrl}/${brandSlug}/${modelSlug}`
      },
      {
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Início", "item": baseUrl },
          { "@type": "ListItem", "position": 2, "name": escapeHtml((model.brands as any).name), "item": `${baseUrl}/${brandSlug}` },
          { "@type": "ListItem", "position": 3, "name": escapeHtml(model.name), "item": `${baseUrl}/${brandSlug}/${modelSlug}` }
        ]
      }
    ]
  })}
  </script>
  ${buildEntityIndexJsonLd(`Impressora 3D ${model.name} ${(model.brands as any).name} impressão 3D odontológica resina fotopolimerização DLP LCD/mSLA`, knowledgeCtx)}
  ${buildGTMHead()}
</head>
<body>
  ${buildGTMBody()}
  ${buildStandardHeaderWithNav(knowledgeCtx)}
  <main id="main-content">
    <article>
      <h1>${escapeHtml(model.name)}</h1>
      ${buildAISummaryBlock(contextText)}
      ${model.notes ? `<p data-section="definition">${escapeHtml(model.notes)}</p>` : `<p data-section="definition">Impressora 3D ${escapeHtml(model.name)} da ${escapeHtml((model.brands as any).name)} com ${resinsCount} configurações de resina validadas para uso clínico em odontologia digital.</p>`}
      <h2>Resinas Disponíveis (${resinsCount})</h2>
      <ul>
        ${uniqueResins.map((r: any) => {
          const resinSlug = `${r.resin_manufacturer}-${r.resin_name}`.toLowerCase().replace(/\s+/g, '-');
          return `<li><a href="/${brandSlug}/${modelSlug}/${resinSlug}">${r.resin_name}</a></li>`;
        }).join('') || ''}
      </ul>
      ${buildLLMKnowledgeLayer(model.name, 'Impressora 3D', knowledgeCtx)}
      ${buildEntityIndexSection(knowledgeCtx)}
    </article>
  </main>
  ${buildKnowledgeGraphJsonLd(knowledgeCtx)}
  ${buildStandardFooter()}
  ${buildBotRedirectScript(`/${brandSlug}/${modelSlug}`)}
</body>
</html>`;
}

async function generateResinHTML(brandSlug: string, modelSlug: string, resinSlug: string, supabase: any): Promise<string> {
  // Buscar parameter_sets e knowledge context em paralelo
  const [paramRes, knowledgeCtx] = await Promise.all([
    supabase.from('parameter_sets').select('*').eq('brand_slug', brandSlug).eq('model_slug', modelSlug).eq('active', true),
    fetchKnowledgeContext(supabase, { limit: 3 }),
  ]);

  if (paramRes.error) {
    console.error('Supabase error fetching parameter_sets:', paramRes.error.message);
    return '';
  }
  const paramSets = paramRes.data;
  if (!paramSets || paramSets.length === 0) {
    console.log('No parameter_sets found for:', brandSlug, modelSlug);
    return '';
  }

  const paramData = paramSets.find((p: any) => {
    const dbSlug = normalizeSlug(`${p.resin_manufacturer}-${p.resin_name}`);
    const requestSlug = normalizeSlug(resinSlug);
    return dbSlug === requestSlug;
  }) || paramSets[0];

  const { data: resinData, error: resinError } = await supabase
    .from('resins').select('*').eq('manufacturer', paramData.resin_manufacturer).eq('name', paramData.resin_name).eq('active', true).maybeSingle();
  if (resinError) console.error('Supabase error fetching resin:', resinError.message);

  const params = paramData;
  const baseUrl = 'https://parametros.smartdent.com.br';
  const resinName = params.resin_name;
  const resinManufacturer = params.resin_manufacturer;
  const seoTitle = resinData?.seo_title_override || `${escapeHtml(resinName)} para ${escapeHtml(modelSlug)} - Parâmetros | Smart Dent`;
  const metaDescription = resinData?.meta_description || `Parâmetros profissionais testados: ${escapeHtml(resinName)}. Layer: ${params.layer_height}mm, Cure: ${params.cure_time}s, Luz: ${params.light_intensity}%.`;
  const canonicalUrl = resinData?.canonical_url || `${baseUrl}/${brandSlug}/${modelSlug}/${resinSlug}`;
  const ogImage = resinData?.og_image_url || resinData?.image_url || `${baseUrl}/og-fluxo-digital.jpg`;
  const keywords = resinData?.keywords || [];
  const contextText = `Resina ${escapeHtml(resinName)} (${escapeHtml(resinManufacturer)}) com parâmetros otimizados para impressora ${escapeHtml(modelSlug)}. Layer height: ${params.layer_height}mm, cure time: ${params.cure_time}s, light intensity: ${params.light_intensity}%.`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${seoTitle}</title>
  <meta name="description" content="${metaDescription}" />
  ${keywords.length > 0 ? `<meta name="keywords" content="${keywords.map(escapeHtml).join(', ')}" />` : ''}
  ${FAVICON_TAGS}
  ${buildAICrawlerPolicy()}
  ${buildEntityReferenceMetas(knowledgeCtx, { type: 'product', name: resinName })}
  <link rel="canonical" href="${canonicalUrl}" />
  ${buildHreflang({ pt: canonicalUrl })}
  <meta property="og:title" content="${escapeHtml(resinData?.name || resinName)} - Parâmetros de Impressão" />
  <meta property="og:description" content="${metaDescription}" />
  <meta property="og:image" content="${ogImage}" />
  <meta property="og:type" content="product" />
  ${buildAIHeadTags({ context: contextText, title: seoTitle, description: metaDescription, image: ogImage, canonicalUrl })}
  <script type="application/ld+json">
  ${safeLd({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Product",
        "name": escapeHtml(resinName),
        "description": resinData?.description || `Resina ${escapeHtml(resinName)} com parâmetros otimizados`,
        "brand": { "@type": "Brand", "name": escapeHtml(resinManufacturer) },
        "image": ogImage,
        "offers": {
          "@type": "Offer",
          "availability": "https://schema.org/InStock",
          "url": canonicalUrl,
          "price": resinData?.price || undefined,
          "priceCurrency": resinData?.price ? "BRL" : undefined,
          "itemCondition": "https://schema.org/NewCondition",
          ...merchantOfferExtras()
        },
        "additionalProperty": [
          { "@type": "PropertyValue", "name": "Layer Height", "value": `${params.layer_height}mm` },
          { "@type": "PropertyValue", "name": "Cure Time", "value": `${params.cure_time}s` },
          { "@type": "PropertyValue", "name": "Light Intensity", "value": `${params.light_intensity}%` }
        ]
      },
      {
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Início", "item": baseUrl },
          { "@type": "ListItem", "position": 2, "name": escapeHtml(brandSlug), "item": `${baseUrl}/${brandSlug}` },
          { "@type": "ListItem", "position": 3, "name": escapeHtml(modelSlug), "item": `${baseUrl}/${brandSlug}/${modelSlug}` },
          { "@type": "ListItem", "position": 4, "name": `${escapeHtml(resinManufacturer)} ${escapeHtml(resinName)}`, "item": canonicalUrl }
        ]
      }
    ]
  })}
  </script>
  ${buildEntityIndexJsonLd(`${resinName} ${resinManufacturer} resina impressão 3D fotopolimerização odontológica DLP LCD/mSLA`, knowledgeCtx)}
  ${buildGTMHead()}
</head>
<body>
  ${buildGTMBody()}
  ${buildStandardHeaderWithNav(knowledgeCtx)}
  <main id="main-content">
    <article>
      <h1>${escapeHtml(resinName)}</h1>
      ${buildAISummaryBlock(contextText)}
      ${resinData?.image_url ? `<img src="${escapeHtml(resinData.image_url)}" alt="${escapeHtml(resinName)}" loading="eager" fetchpriority="high" decoding="async" style="width:100%;max-width:1200px;height:auto;border-radius:12px;margin:1.5rem 0" />` : ''}
      <p data-section="definition">${resinData?.description || `Parâmetros profissionais testados para ${escapeHtml(resinName)} na impressora ${escapeHtml(modelSlug)}.`}</p>
      <section data-section="technical-specs">
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
      </section>
      ${params.notes ? `<p><strong>Observações:</strong> ${escapeHtml(params.notes)}</p>` : ''}
      ${resinData?.cta_1_url ? `<p><a href="${escapeHtml(resinData.cta_1_url)}" target="_blank">${escapeHtml(resinData.cta_1_label || 'Saiba mais')}</a></p>` : ''}
      ${buildCitationBlocks(knowledgeCtx)}
      ${buildLLMKnowledgeLayer(resinName, 'Resina para Impressão 3D', knowledgeCtx, { 'Technology': 'Fotopolimerização', 'Layer Height': `${params.layer_height}mm`, 'Cure Time': `${params.cure_time}s` })}
      ${buildEntityIndexSection(knowledgeCtx)}
    </article>
  </main>
  ${buildStandardFooter()}
  ${buildBotRedirectScript(`/${brandSlug}/${modelSlug}/${resinSlug}`)}
</body>
</html>`;
}

async function generateSystemACatalogHTML(
  category: string, 
  slug: string, 
  supabase: any
): Promise<string> {
  const [itemRes, knowledgeCtx] = await Promise.all([
    supabase.from('system_a_catalog').select('*').eq('category', category).or(`slug.eq.${slug},slug.like.%/${slug}`).eq('active', true).eq('approved', true).maybeSingle(),
    fetchKnowledgeContext(supabase, { limit: 3 }),
  ]);

  if (itemRes.error || !itemRes.data) return generate404();
  const item = itemRes.data;

  const baseUrl = 'https://parametros.smartdent.com.br';
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
  const ogImage = item.og_image_url || item.image_url || `${baseUrl}/og-fluxo-digital.jpg`;
  const keywords = item.keywords || [];

  const extraData = item.extra_data || {};
  const variations = extraData.variations || [];
  const benefits = extraData.benefits || [];
  const features = extraData.features || [];
  const faqs = extraData.faqs || [];
  const videos = extraData.videos || [];

  const aiContext = category === 'product' 
    ? `Produto odontológico: ${escapeHtml(item.name)}. Smart Dent - soluções para odontologia digital.` 
    : `Depoimento sobre Smart Dent: ${escapeHtml(item.name)}.`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(seoTitle)}</title>
  <meta name="description" content="${escapeHtml(metaDescription)}" />
  ${keywords.length > 0 ? `<meta name="keywords" content="${keywords.map(escapeHtml).join(', ')}" />` : ''}
  ${FAVICON_TAGS}
  ${buildAICrawlerPolicy()}
  ${buildEntityReferenceMetas(knowledgeCtx, { type: category === 'product' ? 'product' : 'review', name: item.name })}
  <link rel="canonical" href="${canonicalUrl}" />
  ${buildHreflang({ pt: canonicalUrl })}
  <meta property="og:title" content="${escapeHtml(seoTitle)}" />
  <meta property="og:description" content="${escapeHtml(metaDescription)}" />
  <meta property="og:image" content="${ogImage}" />
  <meta property="og:url" content="${canonicalUrl}" />
  <meta property="og:type" content="${category === 'product' ? 'product' : 'article'}" />
  ${buildAIHeadTags({ context: aiContext, title: seoTitle, description: metaDescription, image: ogImage, canonicalUrl })}
  <script type="application/ld+json">
  ${safeLd(category === 'product' ? {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Product",
        "name": item.name,
        "description": item.description,
        "image": ogImage,
        "brand": { "@type": "Brand", "name": "Smart Dent" },
        "offers": { "@type": "Offer", "url": canonicalUrl, "priceCurrency": item.currency || "BRL", "price": item.promo_price || item.price || undefined, "availability": "https://schema.org/InStock", "itemCondition": "https://schema.org/NewCondition", ...merchantOfferExtras() },
        ...(item.rating && item.review_count > 0 && { "aggregateRating": { "@type": "AggregateRating", "ratingValue": item.rating, "reviewCount": item.review_count, "bestRating": 5, "worstRating": 1 } }),
        ...(faqs.length > 0 && { "mainEntity": faqs.map((faq: any) => ({ "@type": "Question", "name": faq.question, "acceptedAnswer": { "@type": "Answer", "text": faq.answer } })) })
      },
      { "@type": "BreadcrumbList", "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Início", "item": baseUrl },
        { "@type": "ListItem", "position": 2, "name": "Produtos", "item": `${baseUrl}/produtos` },
        { "@type": "ListItem", "position": 3, "name": item.name, "item": canonicalUrl }
      ]}
    ]
  } : category === 'video_testimonial' ? {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Review",
        "itemReviewed": { "@type": "Product", "name": extraData.products_mentioned?.[0] || "Smart Dent", "brand": { "@type": "Brand", "name": "Smart Dent" } },
        "reviewRating": { "@type": "Rating", "ratingValue": extraData.rating || 5, "bestRating": 5, "worstRating": 1 },
        "author": { "@type": "Person", "name": item.name, "jobTitle": extraData.specialty, "address": extraData.location ? { "@type": "PostalAddress", "addressLocality": extraData.location } : undefined },
        "reviewBody": item.description,
        "datePublished": item.created_at,
        ...(videos.length > 0 && { "video": { "@type": "VideoObject", "name": videos[0].title || item.name, "description": item.description, "thumbnailUrl": videos[0].thumbnail_url || ogImage, "uploadDate": item.created_at, "contentUrl": videos[0].url, "embedUrl": videos[0].embed_url || videos[0].url, "duration": videos[0].duration || "PT5M" } })
      },
      { "@type": "BreadcrumbList", "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Início", "item": baseUrl },
        { "@type": "ListItem", "position": 2, "name": "Depoimentos", "item": `${baseUrl}/depoimentos` },
        { "@type": "ListItem", "position": 3, "name": item.name, "item": canonicalUrl }
      ]}
    ]
  } : {
    "@context": "https://schema.org",
    "@type": "Article", "headline": item.name, "description": item.description, "image": ogImage,
    "author": { "@type": "Organization", "name": "Smart Dent" }, "publisher": { "@type": "Organization", "name": "Smart Dent" }
  })}
  </script>
  ${buildEntityIndexJsonLd(`${item.name} ${item.description || ''} odontologia digital impressão 3D`, knowledgeCtx)}
  ${buildKnowledgeGraphJsonLd(knowledgeCtx)}
  ${buildGTMHead()}
</head>
<body>
  ${buildGTMBody()}
  ${buildStandardHeaderWithNav(knowledgeCtx)}
  <main id="main-content">
    <article>
      <h1>${escapeHtml(item.name)}</h1>
      ${buildAISummaryBlock(item.description ? escapeHtml(item.description) : aiContext)}
      ${item.image_url ? `<img src="${escapeHtml(item.image_url)}" alt="${escapeHtml(item.name)}" loading="eager" fetchpriority="high" decoding="async" style="width:100%;max-width:1200px;height:auto;border-radius:12px;margin:1.5rem 0" />` : ''}
  ${benefits.length > 0 ? `<section data-section="benefits"><h2>Benefícios</h2><ul>${benefits.map((b: string) => `<li>${escapeHtml(b)}</li>`).join('')}</ul></section>` : ''}
  ${features.length > 0 ? `<section data-section="features"><h2>Características</h2><ul>${features.map((f: string) => `<li>${escapeHtml(f)}</li>`).join('')}</ul></section>` : ''}
  ${variations.length > 0 ? `<section data-section="variations"><h2>Opções Disponíveis</h2><ul>${variations.map((v: any) => `<li><strong>${escapeHtml(v.name)}</strong>${v.price ? ` - R$ ${v.price}` : ''}${v.description ? `<br>${escapeHtml(v.description)}` : ''}</li>`).join('')}</ul></section>` : ''}
  ${videos.length > 0 ? `<section data-section="videos"><h2>Vídeos</h2><ul>${videos.map((video: any) => `<li><a href="${escapeHtml(video.url)}">${escapeHtml(video.title || 'Assistir vídeo')}</a></li>`).join('')}</ul></section>` : ''}
  ${faqs.length > 0 ? `<section data-section="faq"><h2>Perguntas Frequentes</h2>${faqs.map((faq: any) => `<div><h3>${escapeHtml(faq.question)}</h3><p>${escapeHtml(faq.answer)}</p></div>`).join('')}</section>` : ''}
  ${item.rating && item.review_count > 0 ? `<p><strong>Avaliação:</strong> ${'⭐'.repeat(Math.round(item.rating))} ${item.rating.toFixed(1)}/5 (${item.review_count} ${item.review_count === 1 ? 'avaliação' : 'avaliações'})</p>` : ''}
  ${item.promo_price && item.price ? `<p><strong>De:</strong> <s>R$ ${item.price.toFixed(2)}</s><br><strong>Por:</strong> <span style="color:#e74c3c;font-size:1.2em">R$ ${item.promo_price.toFixed(2)}</span> <span style="color:#27ae60;font-weight:bold">(${Math.round(((item.price - item.promo_price) / item.price) * 100)}% OFF)</span></p>` : item.price ? `<p><strong>Preço:</strong> R$ ${item.price.toFixed(2)}</p>` : ''}
  ${item.cta_1_url ? `<p><a href="${escapeHtml(item.cta_1_url)}" target="_blank" rel="noopener">${escapeHtml(item.cta_1_label || 'Ver na Loja')}</a></p>` : ''}
  ${item.cta_2_url ? `<p><a href="${escapeHtml(item.cta_2_url)}" target="_blank" rel="noopener">${escapeHtml(item.cta_2_label || 'Saiba Mais')}</a></p>` : ''}
  ${item.cta_3_url ? `<p><a href="${escapeHtml(item.cta_3_url)}" target="_blank" rel="noopener">${escapeHtml(item.cta_3_label || 'Mais Informações')}</a></p>` : ''}
      ${buildCitationBlocks(knowledgeCtx)}
      ${buildLLMKnowledgeLayer(item.name, category === 'product' ? 'Produto Odontológico' : 'Depoimento', knowledgeCtx)}
      ${buildEntityIndexSection(knowledgeCtx)}
    </article>
  </main>
  ${buildStandardFooter()}
  ${buildBotRedirectScript(`/${categoryPath}/${slug}`)}
</body>
</html>`;
}

async function generateKnowledgeHubHTML(supabase: any): Promise<string> {
  const knowledgeCtx = await fetchKnowledgeContext(supabase);
  const categories = knowledgeCtx.categories;

  const baseUrl = 'https://parametros.smartdent.com.br';
  const title = 'Base de Conhecimento | Smart Dent';
  const description = 'Artigos, tutoriais e guias sobre impressão 3D odontológica. Aprenda técnicas, resolução de problemas e melhores práticas.';
  const contextText = 'Base de conhecimento profissional sobre impressão 3D odontológica. Conteúdo técnico-científico para cirurgiões-dentistas e técnicos em prótese dentária.';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <meta name="description" content="${description}" />
  ${FAVICON_TAGS}
  ${buildAICrawlerPolicy()}
  ${buildEntityReferenceMetas(knowledgeCtx, { type: 'technology', name: 'Base de Conhecimento' })}
  <link rel="canonical" href="${baseUrl}/base-conhecimento" />
  <link rel="alternate" hreflang="pt-BR" href="${baseUrl}/base-conhecimento" />
  <link rel="alternate" hreflang="en-US" href="${baseUrl}/en/knowledge-base" />
  <link rel="alternate" hreflang="es-ES" href="${baseUrl}/es/base-conocimiento" />
  <link rel="alternate" hreflang="x-default" href="${baseUrl}/base-conhecimento" />
  <meta property="og:title" content="Base de Conhecimento Smart Dent" />
  <meta property="og:description" content="${description}" />
  <meta property="og:image" content="${baseUrl}/og-fluxo-digital.jpg" />
  <meta property="og:type" content="website" />
  ${buildAIHeadTags({ context: contextText, title, description, image: `${baseUrl}/og-fluxo-digital.jpg`, canonicalUrl: `${baseUrl}/base-conhecimento` })}
  <script type="application/ld+json">
  ${safeLd({
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "WebSite", "name": "Base de Conhecimento Smart Dent", "url": `${baseUrl}/base-conhecimento`, "description": "Artigos e tutoriais sobre impressão 3D odontológica" },
      { "@type": "BreadcrumbList", "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Início", "item": baseUrl },
        { "@type": "ListItem", "position": 2, "name": "Base de Conhecimento", "item": `${baseUrl}/base-conhecimento` }
      ]}
    ]
  })}
  </script>
  ${buildEntityIndexJsonLd('impressão 3D odontológica resina fotopolimerização DLP LCD/mSLA CAD/CAM scanner intraoral prótese dentária odontologia digital', knowledgeCtx)}
  ${buildKnowledgeGraphJsonLd(knowledgeCtx)}
  ${buildGTMHead()}
</head>
<body>
  ${buildGTMBody()}
  ${buildStandardHeaderWithNav(knowledgeCtx)}
  <main id="main-content">
    <article>
      <h1>Base de Conhecimento</h1>
      ${buildAISummaryBlock(contextText)}
      <p data-section="definition">Artigos, tutoriais e guias sobre impressão 3D odontológica. Conteúdo produzido por especialistas para cirurgiões-dentistas e técnicos em prótese dentária.</p>
      <h2>Categorias</h2>
      <ul>
        ${categories?.map((c: any) => `<li><a href="/base-conhecimento/${c.letter.toLowerCase()}">${c.letter} - ${c.name}</a></li>`).join('') || ''}
      </ul>
      ${buildLLMKnowledgeLayer('Base de Conhecimento', 'Portal Educacional', knowledgeCtx)}
      ${buildEntityIndexSection(knowledgeCtx)}
    </article>
  </main>
  ${buildStandardFooter()}
  ${buildBotRedirectScript('/conhecimento')}
</body>
</html>`;
}

async function generateKnowledgeCategoryHTML(letter: string, supabase: any): Promise<string> {
  // Sempre normaliza para minúsculo — DB armazena maiúsculo (A–G), URLs canônicas são minúsculas.
  const letterLc = (letter || '').toLowerCase();
  const letterUc = letterLc.toUpperCase();
  const { data: category, error: categoryError } = await supabase
    .from('knowledge_categories').select('*').eq('letter', letterUc).eq('enabled', true).single();

  if (categoryError) { console.error('Supabase error fetching category:', letter, categoryError.message); return ''; }
  if (!category) { console.log('Category not found:', letter); return ''; }

  const [contentsRes, knowledgeCtx] = await Promise.all([
    supabase.from('knowledge_contents').select('title, slug, excerpt').eq('category_id', category.id).eq('active', true).order('order_index').limit(50),
    fetchKnowledgeContext(supabase, { categoryId: category.id, limit: 5 }),
  ]);
  const contents = contentsRes.data;
  if (contentsRes.error) console.error('Supabase error fetching contents:', contentsRes.error.message);

  const baseUrl = 'https://parametros.smartdent.com.br';
  const title = `${escapeHtml(category.letter)} - ${escapeHtml(category.name)} | Base de Conhecimento Smart Dent`;
  const description = `Artigos sobre ${escapeHtml(category.name)}. ${contents?.length || 0} conteúdos disponíveis na base de conhecimento Smart Dent.`;
  const contextText = `Categoria "${escapeHtml(category.name)}" da base de conhecimento Smart Dent. ${contents?.length || 0} artigos técnicos sobre impressão 3D odontológica.`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <meta name="description" content="${description}" />
  ${FAVICON_TAGS}
  ${buildAICrawlerPolicy()}
  ${buildEntityReferenceMetas(knowledgeCtx, { type: 'category', name: category.name })}
  <link rel="canonical" href="${baseUrl}/base-conhecimento/${letter.toLowerCase()}" />
  ${buildHreflang({ pt: `${baseUrl}/base-conhecimento/${letter.toLowerCase()}`, en: `${baseUrl}/en/knowledge-base/${letter.toLowerCase()}`, es: `${baseUrl}/es/base-conocimiento/${letter.toLowerCase()}` })}
  <meta property="og:title" content="${escapeHtml(category.name)} - Base de Conhecimento" />
  <meta property="og:description" content="${description}" />
  <meta property="og:image" content="${baseUrl}/og-fluxo-digital.jpg" />
  <meta property="og:type" content="website" />
  ${buildAIHeadTags({ context: contextText, title, description, image: `${baseUrl}/og-fluxo-digital.jpg`, canonicalUrl: `${baseUrl}/base-conhecimento/${letter.toLowerCase()}` })}
  <script type="application/ld+json">
  ${safeLd({
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "CollectionPage", "name": `${category.letter} - ${category.name}`, "description": description, "url": `${baseUrl}/base-conhecimento/${letter.toLowerCase()}`, "isPartOf": { "@type": "WebSite", "name": "Smart Dent", "url": baseUrl } },
      { "@type": "BreadcrumbList", "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Início", "item": baseUrl },
        { "@type": "ListItem", "position": 2, "name": "Base de Conhecimento", "item": `${baseUrl}/base-conhecimento` },
        { "@type": "ListItem", "position": 3, "name": escapeHtml(category.name), "item": `${baseUrl}/base-conhecimento/${letter.toLowerCase()}` }
      ]}
    ]
  })}
  </script>
  ${buildEntityIndexJsonLd(`${category.name} impressão 3D odontológica resina fotopolimerização odontologia digital`, knowledgeCtx)}
  ${buildGTMHead()}
</head>
<body>
  ${buildGTMBody()}
  ${buildStandardHeaderWithNav(knowledgeCtx)}
  <main id="main-content">
    <article>
      <h1>${escapeHtml(category.letter)} - ${escapeHtml(category.name)}</h1>
      ${buildAISummaryBlock(contextText)}
      <p data-section="definition">${contents?.length || 0} artigos disponíveis nesta categoria.</p>
      <ul>
        ${contents?.map((c: any) => `<li><a href="/base-conhecimento/${letter.toLowerCase()}/${c.slug}">${c.title}</a>${c.excerpt ? `<br><small>${escapeHtml(c.excerpt.substring(0, 120))}</small>` : ''}</li>`).join('') || ''}
      </ul>
      ${buildLLMKnowledgeLayer(category.name, 'Categoria de Conhecimento', knowledgeCtx)}
      ${buildEntityIndexSection(knowledgeCtx)}
    </article>
  </main>
  ${buildKnowledgeGraphJsonLd(knowledgeCtx)}
  ${buildStandardFooter()}
  ${buildBotRedirectScript(`/base-conhecimento/${letter.toLowerCase()}`)}
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

  // Buscar vídeos, resinas, knowledge context e reviews em paralelo
  const [videosRes, knowledgeCtx, companyReviews] = await Promise.all([
    supabase.from('knowledge_videos').select('*').eq('content_id', content.id).order('order_index'),
    fetchKnowledgeContext(supabase, { categoryId: content.category_id, limit: 5 }),
    fetchCompanyReviews(supabase),
  ]);
  const videos = videosRes.data;

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

  // og:image com fallback + URL absoluta (WhatsApp/Facebook não baixam paths relativos
  // nem aceitam content="" — sem isso o card de preview do link fica sem hero).
  const ogImageRaw = content.og_image_url || content.content_image_url || `${baseUrl}/og-fluxo-digital.jpg`;
  const ogImage = /^https?:\/\//i.test(ogImageRaw)
    ? ogImageRaw
    : `${baseUrl}${ogImageRaw.startsWith('/') ? '' : '/'}${ogImageRaw}`;

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
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(content.title)} | Base de Conhecimento Smart Dent</title>
  <meta name="description" content="${escapeHtml(desc)}" />
  ${FAVICON_TAGS}
  <link rel="canonical" href="${baseUrl}/base-conhecimento/${letter}/${slug}" />
  <link rel="alternate" hreflang="pt-BR" href="${baseUrl}/base-conhecimento/${letter}/${slug}" />
  <link rel="alternate" hreflang="en-US" href="${baseUrl}/en/knowledge-base/${letter}/${slug}" />
  <link rel="alternate" hreflang="es-ES" href="${baseUrl}/es/base-conocimiento/${letter}/${slug}" />
  <link rel="alternate" hreflang="x-default" href="${baseUrl}/base-conhecimento/${letter}/${slug}" />
  ${content.keywords ? `<meta name="keywords" content="${escapeHtml(content.keywords.join(', '))}" />` : ''}
  ${buildAICrawlerPolicy()}
  ${buildEntityReferenceMetas(knowledgeCtx, { type: 'article', name: content.title })}
  
  <!-- FASE 3: AI-Context Meta Tag (Experimental para IA Regenerativa) -->
  <meta name="AI-context" content="Conteúdo técnico-científico sobre ${escapeHtml(content.knowledge_categories?.name || 'odontologia')}. Público-alvo: cirurgiões-dentistas e técnicos em prótese dentária. Nível: Expert. Tipo: Artigo técnico." />
  
  <!-- FASE 3: Open Graph Otimizado para IA -->
  <meta property="og:title" content="${escapeHtml(content.title)}" />
  <meta property="og:description" content="${escapeHtml(content.excerpt || desc)}" />
  <meta property="og:type" content="article" />
  <meta property="og:image" content="${ogImage}" />
  <meta property="og:image:secure_url" content="${ogImage}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="${escapeHtml(content.content_image_alt || content.title)}" />
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
    } else {
      return `<meta name="twitter:card" content="summary_large_image" />`;
    }
  })()}
  <meta name="twitter:site" content="@smartdent" />
  <meta name="twitter:creator" content="${content.authors?.twitter_url ? '@' + content.authors.twitter_url.split('/').pop() : '@smartdent'}" />
  <meta name="twitter:title" content="${escapeHtml(content.title)}" />
  <meta name="twitter:description" content="${escapeHtml(content.excerpt || desc)}" />
  <meta name="twitter:image" content="${ogImage}" />
  <meta name="twitter:image:alt" content="${escapeHtml(content.content_image_alt || content.title)}" />
  
  <!-- Structured Data: @graph com Detecção Dinâmica de Tipo (MedicalWebPage/ScholarlyArticle/TechArticle) -->
  <script type="application/ld+json">
  ${(() => {
    const contentType = detectContentType(content);
    const canonicalUrl = `${baseUrl}/base-conhecimento/${letter}/${slug}`;
    const authorSchema = buildAuthorSchema(content.authors, baseUrl);
    const publisherSchema = buildPublisherSchema(baseUrl, companyReviews);
    
    // Construir schema principal baseado no tipo detectado
    let mainArticleSchema: any;
    
    if (contentType === 'MedicalWebPage') {
      mainArticleSchema = buildMedicalWebPageSchema(content, content.authors, baseUrl, canonicalUrl);
    } else if (contentType === 'ScholarlyArticle') {
      mainArticleSchema = buildScholarlyArticleSchema(content, content.authors, baseUrl, canonicalUrl);
    } else {
      // TechArticle (padrão)
      mainArticleSchema = {
        "@type": "TechArticle",
        "@id": canonicalUrl,
        "headline": escapeHtml(content.title),
        "name": escapeHtml(content.title),
        "description": escapeHtml(content.excerpt || desc),
        "image": ogImage,
        "datePublished": content.created_at,
        "dateModified": content.updated_at,
        "url": canonicalUrl,
        "inLanguage": "pt-BR",
        "keywords": content.keywords?.join(', ') || undefined,
        "articleBody": content.content_html?.replace(/<[^>]*>/g, '').substring(0, 5000),
        "proficiencyLevel": "Expert",
        "dependencies": recommendedResins.length > 0 ? recommendedResins.map((r: any) => r.name).join(', ') : undefined,
        "author": { "@id": authorSchema["@id"] },
        "publisher": { "@id": `${baseUrl}/#organization` },
        "mainEntityOfPage": {
          "@type": "WebPage",
          "@id": canonicalUrl
        }
      };
    }
    
    // Construir o @graph completo
    const graph = [
      // Publisher (Organization) - sempre incluir primeiro
      publisherSchema,
      // Author (Person ou Organization)
      authorSchema,
      // Artigo principal (tipo detectado dinamicamente)
      mainArticleSchema,
      // Breadcrumbs
      {
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Início", "item": baseUrl },
          { "@type": "ListItem", "position": 2, "name": "Base de Conhecimento", "item": `${baseUrl}/base-conhecimento` },
          { "@type": "ListItem", "position": 3, "name": escapeHtml(content.knowledge_categories?.name || letter.toUpperCase()), "item": `${baseUrl}/base-conhecimento/${letter.toLowerCase()}` },
          { "@type": "ListItem", "position": 4, "name": escapeHtml(content.title), "item": canonicalUrl }
        ]
      },
      // Videos
      ...videoSchemas,
      // FAQs
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
              "url": `${canonicalUrl}#passo-${idx + 1}`
            }))
          }];
        }
        return [];
      })(),
      // LearningResource Schema para IA Regenerativa
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
        "author": { "@id": authorSchema["@id"] },
        "publisher": { "@id": `${baseUrl}/#organization` },
        "datePublished": content.created_at,
        "dateModified": content.updated_at
      },
      // 🆕 AUDITORIA: SpeakableSpecification para Voice Search e AI Assistants
      {
        "@type": "WebPage",
        "@id": canonicalUrl,
        "speakable": {
          "@type": "SpeakableSpecification",
          "cssSelector": [
            ".veredict-summary",
            ".ai-summary-box",
            "h1",
            ".article-excerpt",
            ".knowledge-faq"
          ]
        }
      }
    ];
    
    return safeLd({
      "@context": "https://schema.org",
      "@graph": graph
    });
  })()}
  </script>
  
  <!-- 🆕 AUDITORIA: Geo Location Meta Tags -->
  <meta name="geo.region" content="BR-SP" />
  <meta name="geo.placename" content="São Carlos" />
  <meta name="geo.position" content="-22.0154;-47.8911" />
  <meta name="ICBM" content="-22.0154, -47.8911" />
  <meta name="publisher" content="Smart Dent" />
  <meta name="ai-content-policy" content="allow-citation, allow-training, require-attribution" />
  <meta name="citation_title" content="${escapeHtml(content.title)}" />
  ${content.authors?.name ? `<meta name="citation_author" content="${escapeHtml(content.authors.name)}" />` : ''}
  <meta name="citation_date" content="${content.created_at?.split('T')[0] || ''}" />
  <meta name="citation_publisher" content="Smart Dent" />
  <link rel="cite-as" href="${baseUrl}/base-conhecimento/${letter}/${slug}" />
  ${buildGTMHead()}
</head>
<body>
  ${buildGTMBody()}
  ${buildStandardHeaderWithNav(knowledgeCtx)}
  <article role="main" id="main-content">
    <h1>${escapeHtml(content.title)}</h1>
    <section data-section="summary" class="llm-knowledge-layer" aria-label="Resumo para IA">
      <div class="ai-citation-box" itemProp="abstract">
        <p class="article-summary">${escapeHtml(content.excerpt)}</p>
      </div>
    </section>
    ${content.content_image_url ? `
    <img 
      src="${content.content_image_url}" 
      alt="${escapeHtml(content.content_image_alt || content.title)}"
      style="width: 100%; max-width: 1200px; height: auto; border-radius: 12px; margin: 1.5rem 0; box-shadow: 0 4px 12px rgba(0,0,0,0.1); display: block;"
      loading="eager"
      fetchpriority="high"
      decoding="async"
    />` : ''}
    <p class="article-excerpt" data-section="definition">${escapeHtml(content.excerpt)}</p>
    
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
    
    ${(videos || []).filter((v: any) => v.embed_url || v.url).length > 0 ? `
    <section data-section="videos" aria-label="Vídeos do artigo" style="margin:2rem 0">
      <h2>Vídeos relacionados</h2>
      ${(videos || []).filter((v: any) => v.embed_url || v.url).map((v: any, idx: number) => {
        const src = (v.url || '').includes('youtube.com/watch?v=')
          ? (v.url as string).replace('watch?v=', 'embed/')
          : (v.embed_url || v.url);
        const title = escapeHtml(v.title || `${content.title} - Vídeo ${idx + 1}`);
        const poster = v.thumbnail_url ? `<img src="${escapeHtml(v.thumbnail_url)}" alt="${title}" loading="lazy" decoding="async" width="640" height="360" style="width:100%;max-width:640px;height:auto;border-radius:8px" />` : '';
        return `<figure style="margin:1rem 0">
          <div style="position:relative;width:100%;max-width:960px;aspect-ratio:16/9">
            <iframe src="${escapeHtml(src)}" title="${title}" loading="lazy" allowfullscreen
              style="position:absolute;inset:0;width:100%;height:100%;border:0;border-radius:8px"></iframe>
          </div>
          <figcaption style="font-size:0.875rem;color:#555;margin-top:0.5rem">${title}</figcaption>
          ${poster ? `<noscript>${poster}</noscript>` : ''}
        </figure>`;
      }).join('')}
    </section>` : ''}

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
    <section data-section="faq">
      <h2>Perguntas Frequentes</h2>
      ${content.faqs.map((faq: any) => `
      <div>
        <h3>${escapeHtml(faq.question)}</h3>
        <p>${escapeHtml(faq.answer)}</p>
      </div>`).join('')}
    </section>` : ''}
    
    ${content.authors ? `
    <aside data-section="author" style="border-top:2px solid #eee;margin-top:2rem;padding-top:2rem">
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
    ${buildCitationBlocks(knowledgeCtx)}
    ${buildLLMKnowledgeLayer(content.title, content.knowledge_categories?.name || 'Artigo Técnico', knowledgeCtx)}
    ${buildEntityIndexSection(knowledgeCtx)}
    ${buildEntityIndexJsonLd(`${content.title} ${content.excerpt || ''} ${content.content_html?.replace(/<[^>]*>/g, '').substring(0, 500) || ''}`, knowledgeCtx)}
  </article>
  ${buildKnowledgeGraphJsonLd(knowledgeCtx)}
  ${buildStandardFooter()}
  ${buildBotRedirectScript(`/base-conhecimento/${letter}/${slug}`)}
</body>
</html>`;
}

async function generatePublicFormHTML(slug: string, supabase: any): Promise<string> {
  const { data: form, error } = await supabase
    .from('smartops_forms')
    .select('id, slug, name, title, subtitle, description, hero_image_url, hero_image_alt, form_purpose, active')
    .eq('slug', slug)
    .eq('active', true)
    .maybeSingle();

  if (error) {
    console.error('[seo-proxy] form fetch error', slug, error.message);
    throw new Error(`form_fetch_failed:${slug}`);
  }
  if (!form) return '';

  const baseUrl = 'https://parametros.smartdent.com.br';
  const canonical = `${baseUrl}/f/${form.slug}`;
  const title = `${escapeHtml(form.title || form.name)} | Smart Dent`;
  const description = escapeHtml(
    (form.description || form.subtitle || `Formulário ${form.name} — Smart Dent | Fluxo Digital.`).slice(0, 300)
  );
  const image = form.hero_image_url || `${baseUrl}/og-fluxo-digital.jpg`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <meta name="description" content="${description}" />
  ${FAVICON_TAGS}
  ${buildAICrawlerPolicy()}
  <link rel="canonical" href="${canonical}" />
  <meta property="og:title" content="${escapeHtml(form.title || form.name)}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:image" content="${image}" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${canonical}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(form.title || form.name)}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${image}" />
  <script type="application/ld+json">
  ${safeLd({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "name": form.title || form.name,
        "description": form.description || form.subtitle || '',
        "url": canonical,
        "isPartOf": { "@type": "WebSite", "name": "Smart Dent", "url": baseUrl }
      },
      {
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Início", "item": baseUrl },
          { "@type": "ListItem", "position": 2, "name": form.title || form.name, "item": canonical }
        ]
      }
    ]
  })}
  </script>
  ${buildGTMHead()}
</head>
<body>
  ${buildGTMBody()}
  <main id="main-content">
    <article>
      <h1>${escapeHtml(form.title || form.name)}</h1>
      ${form.subtitle ? `<p data-section="subtitle">${escapeHtml(form.subtitle)}</p>` : ''}
      ${form.description ? `<p data-section="description">${escapeHtml(form.description)}</p>` : ''}
      ${form.hero_image_url ? `<img src="${form.hero_image_url}" alt="${escapeHtml(form.hero_image_alt || form.title || form.name)}" loading="lazy" />` : ''}
      <p><a href="${canonical}">Preencher formulário</a></p>
    </article>
  </main>
  ${buildStandardFooter()}
  ${buildBotRedirectScript(`/f/${form.slug}`)}
</body>
</html>`;
}

// ===== /distribuidores — Lista oficial de revendas e distribuidores =====

// Helpers de país: slug ↔ nome canônico ↔ código ISO ↔ FAQ.
// Aceita variações antigas/sem acento ("colombia", "estados-unidos", "eua").
const COUNTRY_REGISTRY: Array<{
  slug: string; aliases: string[]; name: string; iso?: string;
  intro: string; intent: string;
}> = [
  { slug: 'brasil', aliases: ['brazil','br'], name: 'Brasil', iso: 'BR',
    intro: 'Smart Dent é fabricante brasileira (São Carlos/SP) e mantém rede nacional de distribuidores autorizados que atendem clínicas, laboratórios e universidades em todo o território.',
    intent: 'Onde comprar resina 3D Smart Print Bio Vitality, scanners, impressoras e insumos Smart Dent no Brasil.' },
  { slug: 'chile', aliases: ['cl'], name: 'Chile', iso: 'CL',
    intro: 'No Chile, os produtos Smart Dent — incluindo a resina 3D Smart Print Bio Vitality, kits SmartMake e adesivos odontológicos — são comercializados por distribuidores oficiais autorizados pela fábrica.',
    intent: 'Onde comprar produtos Smart Dent no Chile — Santiago e demais regiões.' },
  { slug: 'colombia', aliases: ['colômbia','co'], name: 'Colômbia', iso: 'CO',
    intro: 'Na Colômbia, a Smart Dent atende dentistas e laboratórios por meio de distribuidores oficiais com cobertura nacional.',
    intent: 'Onde comprar produtos Smart Dent na Colômbia.' },
  { slug: 'costa-rica', aliases: ['costarica','cr'], name: 'Costa Rica', iso: 'CR',
    intro: 'Na Costa Rica, a Smart Dent é representada por distribuidores oficiais que atendem clínicas e laboratórios.',
    intent: 'Onde comprar produtos Smart Dent na Costa Rica.' },
  { slug: 'republica-dominicana', aliases: ['rep-dominicana','dominicana','do'], name: 'República Dominicana', iso: 'DO',
    intro: 'Na República Dominicana, dentistas e laboratórios compram produtos Smart Dent através de distribuidores oficiais.',
    intent: 'Onde comprar produtos Smart Dent na República Dominicana — Santo Domingo e demais regiões.' },
  { slug: 'estados-unidos', aliases: ['eua','united-states','usa','us'], name: 'Estados Unidos', iso: 'US',
    intro: 'Nos Estados Unidos, a Smart Dent opera por meio de sua subsidiária Smart Dent USA (MMTech North America LLC, Charlotte/NC), parceira da UNC Charlotte University.',
    intent: 'Where to buy Smart Dent products in the United States — Smart Dent USA.' },
  { slug: 'uruguai', aliases: ['uruguay','uy'], name: 'Uruguai', iso: 'UY',
    intro: 'No Uruguai, a Smart Dent é representada por distribuidores oficiais com atendimento em Montevidéu e demais regiões.',
    intent: 'Onde comprar produtos Smart Dent no Uruguai.' },
  { slug: 'venezuela', aliases: ['ve'], name: 'Venezuela', iso: 'VE',
    intro: 'Na Venezuela, os produtos Smart Dent são comercializados por distribuidores autorizados.',
    intent: 'Onde comprar produtos Smart Dent na Venezuela.' },
];

function normalizeCountryKey(s: string): string {
  return (s || '').toString().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/--+/g, '-').replace(/^-|-$/g, '');
}
function findCountryBySlug(slug: string) {
  const k = normalizeCountryKey(slug);
  return COUNTRY_REGISTRY.find(c => c.slug === k || c.aliases.includes(k));
}
function findCountryByName(name?: string | null) {
  if (!name) return null;
  const k = normalizeCountryKey(name);
  return COUNTRY_REGISTRY.find(c => c.slug === k || c.aliases.includes(k) || normalizeCountryKey(c.name) === k);
}
function countrySlugForRow(d: any): string {
  return findCountryByName(d.pais)?.slug || normalizeCountryKey(d.pais || 'outros');
}
function countryNameForRow(d: any): string {
  return findCountryByName(d.pais)?.name || (d.pais || 'Outros');
}

function buildDistributorLocalBusinessLd(d: any, country: { name: string; iso?: string }, canonical: string) {
  const name = d.nome_fantasia || d.razao_social || 'Distribuidor';
  const sameAs = [
    d.site_url, d.instagram, d.facebook, d.linkedin, d.youtube,
    d.wikidata_id ? `https://www.wikidata.org/wiki/${d.wikidata_id}` : null,
  ].filter(Boolean);
  const wa = d.owner_whatsapp ? `+${(d.owner_whatsapp_ddi || '').replace(/\D/g,'')}${d.owner_whatsapp.replace(/\D/g,'')}` : '';
  const scope = Array.isArray(d.authorized_scope) ? d.authorized_scope.join(', ') : '';
  const linhas: string[] = Array.isArray(d.linhas_representadas) ? d.linhas_representadas : [];
  const serviceAreas: any[] = [{ "@type": "Country", "name": country.name, "identifier": country.iso || country.name }];
  if (Array.isArray(d.service_areas)) {
    for (const a of d.service_areas) {
      if (!a) continue;
      if (typeof a === 'string') serviceAreas.push({ "@type": "AdministrativeArea", "name": a });
      else if (a.name) serviceAreas.push({ "@type": a.type || "AdministrativeArea", "name": a.name });
    }
  }
  const ld: any = {
    "@context": "https://schema.org",
    "@type": ["LocalBusiness","Store"],
    "@id": canonical,
    "name": name,
    "url": canonical,
    "inLanguage": d.language_preference || 'pt',
    "address": {
      "@type": "PostalAddress",
      "streetAddress": d.endereco || undefined,
      "addressLocality": d.cidade || undefined,
      "addressRegion": d.estado || undefined,
      "postalCode": d.cep || undefined,
      "addressCountry": country.iso || country.name,
    },
    "areaServed": serviceAreas,
    "brand": { "@type": "Brand", "name": "Smart Dent", "url": "https://www.smartdent.com.br", "sameAs": ["https://www.wikidata.org/wiki/Q138636902"] },
    "parentOrganization": { "@type": "Organization", "name": "Smart Dent", "url": "https://www.smartdent.com.br", "sameAs": ["https://www.wikidata.org/wiki/Q138636902"] },
  };
  if (d.logo_url) ld.logo = d.logo_url;
  if (d.logo_url) ld.image = d.logo_url;
  if (sameAs.length) ld.sameAs = sameAs;
  if (wa) ld.telephone = wa;
  if (d.owner_email) ld.email = d.owner_email;
  if (scope) ld.description = `Distribuidor oficial Smart Dent em ${country.name} — escopo autorizado: ${scope}.`;
  if (d.site_url) ld.hasOfferCatalog = { "@type": "OfferCatalog", "name": `Catálogo Smart Dent — ${name}`, "url": d.site_url };
  if (linhas.length) {
    ld.makesOffer = linhas.map((line) => ({
      "@type": "Offer",
      "itemOffered": { "@type": "Product", "name": line, "brand": { "@type": "Brand", "name": "Smart Dent" } },
      "areaServed": country.name,
      "seller": { "@type": "Organization", "name": name },
    }));
    ld.knowsAbout = linhas;
  }
  return ld;
}

// ===== /distribuidores/{pais} — Hub por país =====
async function generateDistribuidorCountryHTML(countrySlug: string, supabase: any): Promise<string> {
  const country = findCountryBySlug(countrySlug);
  if (!country) return '';
  const baseUrl = 'https://parametros.smartdent.com.br';
  const canonical = `${baseUrl}/distribuidores/${country.slug}`;
  const title = `Distribuidores Oficiais Smart Dent ${country.name === 'Estados Unidos' ? 'nos Estados Unidos' : country.name === 'Brasil' || country.name === 'Uruguai' || country.name === 'Chile' ? 'no ' + country.name : country.name === 'Costa Rica' || country.name === 'Colômbia' || country.name === 'Venezuela' || country.name === 'República Dominicana' ? 'na ' + country.name : country.name} | Onde Comprar`;
  const description = `${country.intent} Lista oficial de revendas autorizadas Smart Dent em ${country.name}: endereço, telefone, WhatsApp, site e linhas representadas.`;

  const { data: rows } = await supabase
    .from('distributors')
    .select('id,razao_social,nome_fantasia,pais,estado,cidade,endereco,cep,site_url,instagram,facebook,linkedin,youtube,owner_email,owner_whatsapp,owner_whatsapp_ddi,authorized_scope,logo_url,slug,service_areas,linhas_representadas,wikidata_id,language_preference')
    .eq('active', true);

  const list = ((rows || []) as any[]).filter(d => countrySlugForRow(d) === country.slug);

  const itemListSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": `Distribuidores Smart Dent em ${country.name}`,
    "itemListElement": list.map((d, i) => {
      const url = `${canonical}/${d.slug || normalizeCountryKey(d.nome_fantasia || d.razao_social || `d-${i+1}`)}`;
      return {
        "@type": "ListItem",
        "position": i + 1,
        "url": url,
        "item": buildDistributorLocalBusinessLd(d, country, url),
      };
    }),
  };

  const breadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Smart Dent", "item": baseUrl },
      { "@type": "ListItem", "position": 2, "name": "Distribuidores", "item": `${baseUrl}/distribuidores` },
      { "@type": "ListItem", "position": 3, "name": country.name, "item": canonical },
    ],
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": `Onde comprar produtos Smart Dent em ${country.name}?`,
        "acceptedAnswer": { "@type": "Answer", "text": `Em ${country.name}, os produtos Smart Dent são comercializados por distribuidores oficiais autorizados pela fábrica: ${list.map(d => d.nome_fantasia || d.razao_social).filter(Boolean).join(', ') || '—'}.` }
      },
      {
        "@type": "Question",
        "name": `A resina 3D Smart Print Bio Vitality está disponível em ${country.name}?`,
        "acceptedAnswer": { "@type": "Answer", "text": `Sim. A resina 3D Smart Print Bio Vitality (FDA 510(k) K260152) é distribuída em ${country.name} pelos representantes oficiais Smart Dent listados nesta página.` }
      },
      {
        "@type": "Question",
        "name": `Como me tornar distribuidor Smart Dent em ${country.name}?`,
        "acceptedAnswer": { "@type": "Answer", "text": `Solicite credenciamento em ${baseUrl}/cadastro-distribuidor — o time comercial Smart Dent retorna em até 3 dias úteis.` }
      }
    ]
  };

  const cards = list.map(d => {
    const name = escapeHtml(d.nome_fantasia || d.razao_social || 'Distribuidor');
    const local = [d.cidade, d.estado].filter(Boolean).map(escapeHtml).join(' / ');
    const scope = Array.isArray(d.authorized_scope) ? d.authorized_scope.join(', ') : '';
    const detail = `${canonical}/${d.slug || normalizeCountryKey(d.nome_fantasia || d.razao_social)}`;
    const wa = d.owner_whatsapp ? `${(d.owner_whatsapp_ddi || '').replace(/\D/g,'')}${d.owner_whatsapp.replace(/\D/g,'')}` : '';
    return `
    <article itemscope itemtype="https://schema.org/LocalBusiness" style="border:1px solid #e2e8f0;border-radius:10px;padding:1.1rem;background:#fff">
      <h2 itemprop="name" style="margin:0 0 .35rem;font-size:1.1rem;color:#0f172a"><a href="${detail}" style="color:#0f172a;text-decoration:none">${name}</a></h2>
      ${local ? `<p style="margin:.15rem 0;color:#475569;font-size:.9rem"><span itemprop="address">${local}</span></p>` : ''}
      ${d.endereco ? `<p style="margin:.15rem 0;color:#475569;font-size:.85rem">${escapeHtml(d.endereco)}</p>` : ''}
      ${scope ? `<p style="margin:.15rem 0;color:#334155;font-size:.85rem"><strong>Linhas autorizadas:</strong> ${escapeHtml(scope)}</p>` : ''}
      <p style="margin:.55rem 0 0;font-size:.88rem">
        <a href="${detail}" style="color:#2563eb;margin-right:.75rem">Ver ficha completa</a>
        ${d.site_url ? `<a itemprop="url" href="${escapeHtml(d.site_url)}" rel="nofollow noopener" target="_blank" style="color:#2563eb;margin-right:.75rem">Site oficial</a>` : ''}
        ${wa ? `<a href="https://wa.me/${wa}" rel="nofollow noopener" target="_blank" style="color:#16a34a">WhatsApp</a>` : ''}
      </p>
    </article>`;
  }).join('');

  const contextText = `${country.intent} Distribuidores oficiais Smart Dent em ${country.name}: ${list.map(d => d.nome_fantasia || d.razao_social).filter(Boolean).join(', ') || '—'}.`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${canonical}" />
  ${buildHreflang({ pt: canonical })}
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:url" content="${canonical}" />
  <meta property="og:type" content="website" />
  ${buildAIHeadTags({ context: contextText, title, description, image: `${baseUrl}/og-fluxo-digital.jpg`, canonicalUrl: canonical })}
  <script type="application/ld+json">${safeLd(itemListSchema)}</script>
  <script type="application/ld+json">${safeLd(breadcrumbs)}</script>
  <script type="application/ld+json">${safeLd(faqSchema)}</script>
</head>
<body style="font-family:system-ui,-apple-system,sans-serif;max-width:1100px;margin:0 auto;padding:1.5rem;color:#1e293b">
  <header style="margin-bottom:1.5rem">
    <nav style="font-size:.85rem;color:#64748b;margin-bottom:.5rem">
      <a href="${baseUrl}/" style="color:#2563eb;text-decoration:none">Smart Dent</a> &rsaquo;
      <a href="${baseUrl}/distribuidores" style="color:#2563eb;text-decoration:none">Distribuidores</a> &rsaquo;
      ${escapeHtml(country.name)}
    </nav>
    <h1 style="font-size:1.75rem;margin:0;color:#0f172a">Distribuidores Oficiais Smart Dent — ${escapeHtml(country.name)}</h1>
    <p style="color:#475569;max-width:820px;margin-top:.5rem">${escapeHtml(country.intro)}</p>
  </header>
  <main>
    <section style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:1rem">${cards || '<p>Lista em atualização.</p>'}</section>
    <section style="margin-top:2.5rem;padding:1.25rem;background:#f8fafc;border-radius:10px">
      <h2 style="margin:0 0 .75rem;font-size:1.15rem;color:#0f172a">Perguntas frequentes</h2>
      <h3 style="margin:.75rem 0 .25rem;font-size:.95rem;color:#0f172a">Onde comprar produtos Smart Dent em ${escapeHtml(country.name)}?</h3>
      <p style="margin:0;color:#475569;font-size:.92rem">Em ${escapeHtml(country.name)}, os produtos Smart Dent são comercializados pelos distribuidores oficiais listados acima.</p>
      <h3 style="margin:.75rem 0 .25rem;font-size:.95rem;color:#0f172a">A resina Smart Print Bio Vitality está disponível em ${escapeHtml(country.name)}?</h3>
      <p style="margin:0;color:#475569;font-size:.92rem">Sim — a resina 3D com aprovação FDA 510(k) K260152 é distribuída pelos representantes oficiais Smart Dent.</p>
    </section>
  </main>
  ${buildStandardFooter()}
  ${buildBotRedirectScript(`/distribuidores/${country.slug}`)}
</body>
</html>`;
}

// ===== /distribuidores/{pais}/{slug} — Ficha de distribuidor =====
async function generateDistribuidorDetailHTML(countrySlug: string, distSlug: string, supabase: any): Promise<string> {
  const country = findCountryBySlug(countrySlug);
  if (!country) return '';
  const baseUrl = 'https://parametros.smartdent.com.br';

  const { data: rows } = await supabase
    .from('distributors')
    .select('id,razao_social,nome_fantasia,pais,estado,cidade,endereco,cep,site_url,instagram,facebook,linkedin,youtube,owner_name,owner_email,owner_whatsapp,owner_whatsapp_ddi,buyer_name,buyer_email,buyer_whatsapp_ddi,buyer_whatsapp,authorized_scope,logo_url,slug,canal_venda,tipo,description_en,description_es')
    .eq('active', true);

  const all = (rows || []) as any[];
  const candidates = all.filter(d => countrySlugForRow(d) === country.slug);
  const wanted = normalizeCountryKey(distSlug);
  const d = candidates.find(x =>
    (x.slug || '').toLowerCase() === wanted ||
    normalizeCountryKey(x.nome_fantasia || '') === wanted ||
    normalizeCountryKey(x.razao_social || '') === wanted
  );
  if (!d) return '';

  const slug = d.slug || normalizeCountryKey(d.nome_fantasia || d.razao_social || 'distribuidor');
  const canonical = `${baseUrl}/distribuidores/${country.slug}/${slug}`;
  const name = d.nome_fantasia || d.razao_social || 'Distribuidor';
  const local = [d.cidade, d.estado].filter(Boolean).join(' / ');
  const scope = Array.isArray(d.authorized_scope) ? d.authorized_scope.join(', ') : '';
  const wa = d.owner_whatsapp ? `${(d.owner_whatsapp_ddi || '').replace(/\D/g,'')}${d.owner_whatsapp.replace(/\D/g,'')}` : '';
  const mapsQ = encodeURIComponent([d.endereco, d.cidade, d.estado, country.name].filter(Boolean).join(', '));

  const title = `${name} — Distribuidor Oficial Smart Dent em ${country.name}`;
  const description = `${name} é distribuidor autorizado Smart Dent em ${country.name}${local ? ' (' + local + ')' : ''}. Contato, endereço, WhatsApp, site e linhas representadas (resinas 3D, scanners, impressoras, kits SmartMake).`;

  const localBusiness = buildDistributorLocalBusinessLd(d, country, canonical);
  const breadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Smart Dent", "item": baseUrl },
      { "@type": "ListItem", "position": 2, "name": "Distribuidores", "item": `${baseUrl}/distribuidores` },
      { "@type": "ListItem", "position": 3, "name": country.name, "item": `${baseUrl}/distribuidores/${country.slug}` },
      { "@type": "ListItem", "position": 4, "name": name, "item": canonical },
    ],
  };
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      { "@type": "Question", "name": `${name} vende produtos Smart Dent?`,
        "acceptedAnswer": { "@type": "Answer", "text": `Sim. ${name} é distribuidor oficial Smart Dent autorizado em ${country.name}${scope ? ' para as linhas: ' + scope : ''}.` } },
      { "@type": "Question", "name": `Como comprar produtos Smart Dent na ${name}?`,
        "acceptedAnswer": { "@type": "Answer", "text": `Contato direto: ${d.site_url ? d.site_url : ''}${wa ? ' — WhatsApp +' + wa : ''}${d.owner_email ? ' — Email ' + d.owner_email : ''}.` } },
    ]
  };

  const contextText = `${name} — distribuidor oficial Smart Dent em ${country.name}. ${scope ? 'Linhas autorizadas: ' + scope + '.' : ''}`;

  const socialBlock = [
    d.site_url ? `<a href="${escapeHtml(d.site_url)}" rel="nofollow noopener" target="_blank" style="color:#2563eb;margin-right:.75rem">Site oficial</a>` : '',
    d.instagram ? `<a href="${escapeHtml(d.instagram)}" rel="nofollow noopener" target="_blank" style="color:#E1306C;margin-right:.75rem">Instagram</a>` : '',
    d.facebook ? `<a href="${escapeHtml(d.facebook)}" rel="nofollow noopener" target="_blank" style="color:#1877F2;margin-right:.75rem">Facebook</a>` : '',
    d.linkedin ? `<a href="${escapeHtml(d.linkedin)}" rel="nofollow noopener" target="_blank" style="color:#0A66C2;margin-right:.75rem">LinkedIn</a>` : '',
    d.youtube ? `<a href="${escapeHtml(d.youtube)}" rel="nofollow noopener" target="_blank" style="color:#FF0000">YouTube</a>` : '',
  ].filter(Boolean).join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${canonical}" />
  ${buildHreflang({ pt: canonical })}
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:url" content="${canonical}" />
  <meta property="og:type" content="business.business" />
  ${d.logo_url ? `<meta property="og:image" content="${escapeHtml(d.logo_url)}" />` : ''}
  ${buildAIHeadTags({ context: contextText, title, description, image: d.logo_url || `${baseUrl}/og-fluxo-digital.jpg`, canonicalUrl: canonical })}
  <script type="application/ld+json">${safeLd(localBusiness)}</script>
  <script type="application/ld+json">${safeLd(breadcrumbs)}</script>
  <script type="application/ld+json">${safeLd(faqSchema)}</script>
</head>
<body style="font-family:system-ui,-apple-system,sans-serif;max-width:900px;margin:0 auto;padding:1.5rem;color:#1e293b">
  <header style="margin-bottom:1.5rem">
    <nav style="font-size:.85rem;color:#64748b;margin-bottom:.5rem">
      <a href="${baseUrl}/" style="color:#2563eb;text-decoration:none">Smart Dent</a> &rsaquo;
      <a href="${baseUrl}/distribuidores" style="color:#2563eb;text-decoration:none">Distribuidores</a> &rsaquo;
      <a href="${baseUrl}/distribuidores/${country.slug}" style="color:#2563eb;text-decoration:none">${escapeHtml(country.name)}</a> &rsaquo;
      ${escapeHtml(name)}
    </nav>
    <div style="display:flex;align-items:center;gap:1rem;flex-wrap:wrap">
      ${d.logo_url ? `<img src="${escapeHtml(d.logo_url)}" alt="${escapeHtml(name)}" style="width:88px;height:88px;object-fit:contain;border:1px solid #e2e8f0;border-radius:10px;background:#fff;padding:6px" />` : ''}
      <div>
        <h1 style="font-size:1.6rem;margin:0;color:#0f172a">${escapeHtml(name)}</h1>
        <p style="margin:.25rem 0 0;color:#475569">Distribuidor Oficial Smart Dent em ${escapeHtml(country.name)}</p>
      </div>
    </div>
  </header>
  <main>
    <section itemscope itemtype="https://schema.org/LocalBusiness" style="border:1px solid #e2e8f0;border-radius:10px;padding:1.25rem;background:#fff;margin-bottom:1.25rem">
      <h2 style="margin:0 0 .75rem;font-size:1.1rem;color:#0f172a">Contato e endereço</h2>
      ${d.razao_social && d.razao_social !== d.nome_fantasia ? `<p style="margin:.2rem 0"><strong>Razão social:</strong> ${escapeHtml(d.razao_social)}</p>` : ''}
      ${d.endereco ? `<p style="margin:.2rem 0" itemprop="address">${escapeHtml(d.endereco)}</p>` : ''}
      ${local ? `<p style="margin:.2rem 0">${escapeHtml(local)} — ${escapeHtml(country.name)}</p>` : ''}
      ${d.cep ? `<p style="margin:.2rem 0"><strong>CEP:</strong> ${escapeHtml(d.cep)}</p>` : ''}
      ${wa ? `<p style="margin:.2rem 0"><strong>WhatsApp:</strong> <a href="https://wa.me/${wa}" rel="nofollow noopener" target="_blank" style="color:#16a34a">+${escapeHtml(wa)}</a></p>` : ''}
      ${d.owner_email ? `<p style="margin:.2rem 0"><strong>E-mail:</strong> <a href="mailto:${escapeHtml(d.owner_email)}" style="color:#2563eb">${escapeHtml(d.owner_email)}</a></p>` : ''}
      ${mapsQ ? `<p style="margin:.5rem 0 0"><a href="https://www.google.com/maps/search/?api=1&query=${mapsQ}" rel="nofollow noopener" target="_blank" style="color:#2563eb">Abrir no Google Maps</a></p>` : ''}
      ${socialBlock ? `<p style="margin:.75rem 0 0">${socialBlock}</p>` : ''}
    </section>

    ${scope ? `<section style="border:1px solid #e2e8f0;border-radius:10px;padding:1.25rem;background:#fff;margin-bottom:1.25rem">
      <h2 style="margin:0 0 .5rem;font-size:1.1rem;color:#0f172a">Linhas Smart Dent representadas</h2>
      <p style="margin:0;color:#334155">${escapeHtml(scope)}</p>
    </section>` : ''}

    <section style="border:1px solid #2563eb33;background:#eff6ff;border-radius:10px;padding:1rem 1.25rem">
      <p style="margin:0;color:#0f172a;font-size:.95rem"><strong>Selo Distribuidor Oficial:</strong> esta página é a fonte oficial Smart Dent confirmando que <strong>${escapeHtml(name)}</strong> é distribuidor autorizado em ${escapeHtml(country.name)}.</p>
    </section>
  </main>
  ${buildStandardFooter()}
  ${buildBotRedirectScript(`/distribuidores/${country.slug}/${slug}`)}
</body>
</html>`;
}

// ===== /distribuidores — Lista oficial de revendas e distribuidores =====
async function generateDistribuidoresHTML(supabase: any): Promise<string> {
  const baseUrl = 'https://parametros.smartdent.com.br';
  const canonical = `${baseUrl}/distribuidores`;
  const title = 'Distribuidores e Revendas Oficiais Smart Dent | América Latina';
  const description = 'Rede oficial de distribuidores Smart Dent no Brasil e América Latina: Chile, Colômbia, Costa Rica, República Dominicana, EUA, Uruguai e Venezuela.';

  const { data: rows } = await supabase
    .from('distributors')
    .select('id,razao_social,nome_fantasia,pais,estado,cidade,site_url,instagram,owner_whatsapp,owner_whatsapp_ddi,authorized_scope,logo_url,tipo,canal_venda')
    .eq('active', true);

  const distribuidores = (rows || []) as any[];

  // Group by country for visible body
  const COUNTRY_ORDER = ['Brasil','Chile','Colômbia','Costa Rica','República Dominicana','EUA','Uruguai','Venezuela'];
  const byCountry: Record<string, any[]> = {};
  for (const d of distribuidores) {
    const k = d.pais || 'Outros';
    (byCountry[k] = byCountry[k] || []).push(d);
  }
  const orderedCountries = [
    ...COUNTRY_ORDER.filter(c => byCountry[c]),
    ...Object.keys(byCountry).filter(c => !COUNTRY_ORDER.includes(c)),
  ];

  const itemListSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": "Distribuidores Oficiais Smart Dent",
    "itemListElement": distribuidores.map((d, i) => {
      const name = d.nome_fantasia || d.razao_social || 'Distribuidor';
      const sameAs = [d.instagram].filter(Boolean);
      const scope = Array.isArray(d.authorized_scope) ? d.authorized_scope.join(', ') : '';
      const org: any = {
        "@type": "Organization",
        "name": name,
        "url": d.site_url || canonical,
        "address": {
          "@type": "PostalAddress",
          "addressLocality": d.cidade || undefined,
          "addressRegion": d.estado || undefined,
          "addressCountry": d.pais || undefined,
        },
        "areaServed": d.pais || undefined,
      };
      if (d.logo_url) org.logo = d.logo_url;
      if (sameAs.length) org.sameAs = sameAs;
      if (scope) org.description = `Revenda autorizada Smart Dent — ${scope}`;
      return { "@type": "ListItem", "position": i + 1, "item": org };
    }),
  };

  const breadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Smart Dent", "item": baseUrl },
      { "@type": "ListItem", "position": 2, "name": "Distribuidores", "item": canonical },
    ],
  };

  const cards = orderedCountries.map(country => {
    const countryMeta = findCountryByName(country);
    const countryUrl = countryMeta ? `${baseUrl}/distribuidores/${countryMeta.slug}` : null;
    const list = byCountry[country].map(d => {
      const name = escapeHtml(d.nome_fantasia || d.razao_social || 'Distribuidor');
      const local = [d.cidade, d.estado].filter(Boolean).map(escapeHtml).join(' / ');
      const scope = Array.isArray(d.authorized_scope) ? d.authorized_scope.join(', ') : '';
      const wa = d.owner_whatsapp ? `${(d.owner_whatsapp_ddi || '').replace(/\D/g, '')}${d.owner_whatsapp.replace(/\D/g, '')}` : '';
      const slug = d.slug || normalizeCountryKey(d.nome_fantasia || d.razao_social || '');
      const detail = countryMeta && slug ? `${baseUrl}/distribuidores/${countryMeta.slug}/${slug}` : null;
      return `
      <article itemscope itemtype="https://schema.org/Organization" style="border:1px solid #e2e8f0;border-radius:10px;padding:1rem;background:#fff">
        <h3 itemprop="name" style="margin:0 0 .35rem;font-size:1.05rem;color:#0f172a">${detail ? `<a href="${detail}" style="color:#0f172a;text-decoration:none">${name}</a>` : name}</h3>
        ${local ? `<p style="margin:.15rem 0;color:#475569;font-size:.9rem">${local}</p>` : ''}
        ${scope ? `<p style="margin:.15rem 0;color:#334155;font-size:.85rem">Escopo autorizado: ${escapeHtml(scope)}</p>` : ''}
        <p style="margin:.5rem 0 0;font-size:.85rem">
          ${detail ? `<a href="${detail}" style="color:#2563eb;margin-right:.75rem">Ficha completa</a>` : ''}
          ${d.site_url ? `<a itemprop="url" href="${escapeHtml(d.site_url)}" rel="nofollow" style="color:#2563eb;margin-right:.75rem">Site oficial</a>` : ''}
          ${wa ? `<a href="https://wa.me/${wa}" rel="nofollow" style="color:#16a34a">WhatsApp</a>` : ''}
        </p>
      </article>`;
    }).join('');
    return `<section style="margin:2rem 0">
      <h2 style="font-size:1.25rem;color:#0f172a;border-bottom:2px solid #2563eb;padding-bottom:.35rem">${countryUrl ? `<a href="${countryUrl}" style="color:#0f172a;text-decoration:none">${escapeHtml(country)}</a>` : escapeHtml(country)}</h2>
      ${countryUrl ? `<p style="margin:.35rem 0 .5rem;font-size:.85rem"><a href="${countryUrl}" style="color:#2563eb">Página dedicada — distribuidores Smart Dent em ${escapeHtml(country)}</a></p>` : ''}
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:1rem;margin-top:1rem">${list}</div>
    </section>`;
  }).join('');

  const contextText = `Distribuidores e revendas oficiais Smart Dent: ${orderedCountries.join(', ')}.`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <meta name="description" content="${description}">
  <link rel="canonical" href="${canonical}" />
  ${buildHreflang({ pt: canonical })}
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:url" content="${canonical}" />
  <meta property="og:type" content="website" />
  ${buildAIHeadTags({ context: contextText, title, description, image: `${baseUrl}/og-fluxo-digital.jpg`, canonicalUrl: canonical })}
  <script type="application/ld+json">${JSON.stringify(itemListSchema)}</script>
  <script type="application/ld+json">${JSON.stringify(breadcrumbs)}</script>
</head>
<body style="font-family:system-ui,-apple-system,sans-serif;max-width:1100px;margin:0 auto;padding:1.5rem;color:#1e293b">
  <header style="margin-bottom:1.5rem">
    <nav style="font-size:.85rem;color:#64748b;margin-bottom:.5rem">
      <a href="${baseUrl}/" style="color:#2563eb;text-decoration:none">Smart Dent</a> &rsaquo; Distribuidores
    </nav>
    <h1 style="font-size:1.75rem;margin:0;color:#0f172a">Distribuidores e Revendas Oficiais Smart Dent</h1>
    <p style="color:#475569;max-width:780px;margin-top:.5rem">${escapeHtml(description)}</p>
  </header>
  <main>${cards || '<p>Lista em atualização.</p>'}</main>
  ${buildStandardFooter()}
  ${buildBotRedirectScript('/distribuidores')}
</body>
</html>`;
}

// ===== /eventos — Agenda oficial de eventos Smart Dent =====
async function generateEventosHTML(supabase: any): Promise<string> {
  const baseUrl = 'https://parametros.smartdent.com.br';
  const canonical = `${baseUrl}/eventos`;
  const title = 'Eventos de Odontologia Digital 2026 | Smart Dent';
  const description = 'Smart Dent presente nos principais eventos de odontologia digital, impressão 3D e CAD/CAM no Brasil e América Latina em 2026.';

  const { data: rows } = await supabase
    .from('smartops_events')
    .select('id,name,country,start_date,end_date,location,company_stand,website_url,cover_image_url')
    .eq('is_active', true)
    .order('start_date', { ascending: true, nullsFirst: false });

  const eventos = (rows || []) as any[];

  const itemListSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": "Eventos Smart Dent 2026",
    "itemListElement": eventos.map((e, i) => {
      const ev: any = {
        "@type": "Event",
        "name": e.name,
        "startDate": e.start_date,
        "endDate": e.end_date || e.start_date,
        "eventStatus": "https://schema.org/EventScheduled",
        "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
        "location": {
          "@type": "Place",
          "name": e.location || e.country || 'A definir',
          "address": { "@type": "PostalAddress", "addressLocality": e.location || undefined, "addressCountry": e.country || undefined },
        },
        "organizer": { "@type": "Organization", "name": "Smart Dent", "url": baseUrl },
      };
      if (e.website_url) ev.url = e.website_url;
      if (e.cover_image_url) ev.image = e.cover_image_url;
      return { "@type": "ListItem", "position": i + 1, "item": ev };
    }),
  };

  const breadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Smart Dent", "item": baseUrl },
      { "@type": "ListItem", "position": 2, "name": "Eventos", "item": canonical },
    ],
  };

  const fmt = (d?: string | null) => {
    if (!d) return '';
    try { return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }); }
    catch { return d; }
  };

  const cards = eventos.map(e => {
    const range = e.start_date && e.end_date && e.start_date !== e.end_date
      ? `${fmt(e.start_date)} &mdash; ${fmt(e.end_date)}`
      : fmt(e.start_date || e.end_date);
    const loc = [e.location, e.country].filter(Boolean).map(escapeHtml).join(' &mdash; ');
    return `
    <article itemscope itemtype="https://schema.org/Event" style="border:1px solid #e2e8f0;border-radius:10px;padding:1.25rem;background:#fff;margin-bottom:1rem">
      <h2 itemprop="name" style="margin:0 0 .5rem;font-size:1.15rem;color:#0f172a">${escapeHtml(e.name)}</h2>
      ${range ? `<p style="margin:.2rem 0;color:#1e293b"><strong>Quando:</strong> <time itemprop="startDate" datetime="${e.start_date || ''}">${range}</time></p>` : ''}
      ${loc ? `<p style="margin:.2rem 0;color:#475569"><strong>Onde:</strong> ${loc}</p>` : ''}
      ${e.company_stand ? `<p style="margin:.2rem 0;color:#0f172a"><strong>Stand Smart Dent:</strong> ${escapeHtml(e.company_stand)}</p>` : ''}
      ${e.website_url ? `<p style="margin:.5rem 0 0"><a itemprop="url" href="${escapeHtml(e.website_url)}" rel="nofollow" style="color:#2563eb">Site do evento</a></p>` : ''}
    </article>`;
  }).join('');

  const contextText = `Calendário oficial de eventos Smart Dent 2026 — odontologia digital, impressão 3D e CAD/CAM.`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <meta name="description" content="${description}">
  <link rel="canonical" href="${canonical}" />
  ${buildHreflang({ pt: canonical })}
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:url" content="${canonical}" />
  <meta property="og:type" content="website" />
  ${buildAIHeadTags({ context: contextText, title, description, image: `${baseUrl}/og-fluxo-digital.jpg`, canonicalUrl: canonical })}
  <script type="application/ld+json">${JSON.stringify(itemListSchema)}</script>
  <script type="application/ld+json">${JSON.stringify(breadcrumbs)}</script>
</head>
<body style="font-family:system-ui,-apple-system,sans-serif;max-width:900px;margin:0 auto;padding:1.5rem;color:#1e293b">
  <header style="margin-bottom:1.5rem">
    <nav style="font-size:.85rem;color:#64748b;margin-bottom:.5rem">
      <a href="${baseUrl}/" style="color:#2563eb;text-decoration:none">Smart Dent</a> &rsaquo; Eventos
    </nav>
    <h1 style="font-size:1.75rem;margin:0;color:#0f172a">Eventos de Odontologia Digital 2026</h1>
    <p style="color:#475569;max-width:780px;margin-top:.5rem">${escapeHtml(description)}</p>
  </header>
  <main>${cards || '<p>Agenda em atualização.</p>'}</main>
  ${buildStandardFooter()}
  ${buildBotRedirectScript('/eventos')}
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
  
  // FIXED: Read original path from query parameter (set by Vercel rewrite)
  const originalPath = url.searchParams.get('originalPath') || '';
  const path = originalPath.replace(/^\/+$/, '').replace(/^\//, ''); // Remove leading/trailing slashes
  const segments = path.length === 0 ? [] : path.split('/').filter(Boolean);

  console.log('SEO Proxy:', { path, segments, originalPath, userAgent });

  let html = '';
  let notFoundReason: 'unknown_route' | 'not_found' | null = null;

  try {
    if (segments[0] === 'produtos' && segments.length === 2) {
      html = await generateSystemACatalogHTML('product', segments[1], supabase);
    } else if (segments[0] === 'depoimentos' && segments.length === 2) {
      html = await generateSystemACatalogHTML('video_testimonial', segments[1], supabase);
    } else if (segments[0] === 'categorias' && segments.length === 2) {
      html = await generateSystemACatalogHTML('category_config', segments[1], supabase);
    } else if (segments[0] === 'f' && segments.length === 2) {
      html = await generatePublicFormHTML(segments[1], supabase);
    } else if (segments[0] === 'distribuidores' && segments.length === 1) {
      html = await generateDistribuidoresHTML(supabase);
    } else if (segments[0] === 'distribuidores' && segments.length === 2) {
      html = await generateDistribuidorCountryHTML(segments[1], supabase);
    } else if (segments[0] === 'distribuidores' && segments.length === 3) {
      html = await generateDistribuidorDetailHTML(segments[1], segments[2], supabase);
    } else if (segments[0] === 'eventos' && segments.length === 1) {
      html = await generateEventosHTML(supabase);
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
    } else {
      notFoundReason = 'unknown_route';
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
    // Don't mask internal errors as 404 — that makes crawlers de-index live pages.
    // Return 503 so Google retries instead of treating it as gone.
    console.error('[seo-proxy] Internal error', {
      originalPath,
      segments,
      userAgent,
      message: (error as Error)?.message,
      stack: (error as Error)?.stack,
    });
    return new Response(generate404(), {
      status: 503,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'Retry-After': '60',
      },
    });
  }
});
