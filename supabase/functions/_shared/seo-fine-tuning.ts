// ═══════════════════════════════════════════════════════════════════════════
// SEO FINE-TUNING — GEO / hreflang / SpeakableSpec / canonical / head
// Builds complete SEO <head> blocks and GEO structured data
// ═══════════════════════════════════════════════════════════════════════════

export interface HreflangEntry {
  lang: string; // e.g. 'pt-BR', 'en', 'es'
  url: string;
}

export interface SeoHeadOptions {
  title: string;          // Max 60 chars recommended
  description: string;    // Max 160 chars recommended
  canonical: string;      // Full canonical URL
  ogImage?: string;
  ogType?: string;
  hreflangEntries?: HreflangEntry[];
  robots?: string;
  language?: string;
}

export interface ImageTagOptions {
  src: string;
  alt: string;
  width: number;
  height: number;
  isLCP?: boolean;        // true = fetchpriority="high", loading="eager"
  cssClass?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// SEO HEAD BUILDER
// ═══════════════════════════════════════════════════════════════════════════

export function buildSeoHead(opts: SeoHeadOptions): string {
  const {
    title,
    description,
    canonical,
    ogImage,
    ogType = 'article',
    hreflangEntries = [],
    robots = 'index, follow',
    language = 'pt-BR',
  } = opts;

  // Enforce character limits with warnings
  const safeTitle = title.length > 60 ? title.substring(0, 57) + '...' : title;
  const safeDesc = description.length > 160 ? description.substring(0, 157) + '...' : description;

  const hreflangTags = buildHreflangTags(hreflangEntries);

  return `<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(safeTitle)}</title>
  <meta name="description" content="${escapeHtml(safeDesc)}" />
  <link rel="canonical" href="${canonical}" />
  <meta name="robots" content="${robots}" />
  <meta property="og:title" content="${escapeHtml(safeTitle)}" />
  <meta property="og:description" content="${escapeHtml(safeDesc)}" />
  <meta property="og:url" content="${canonical}" />
  <meta property="og:type" content="${ogType}" />
  <meta property="og:locale" content="${language.replace('-', '_')}" />
  <meta property="og:site_name" content="SmartDent" />
${ogImage ? `  <meta property="og:image" content="${ogImage}" />\n` : ''}\
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(safeTitle)}" />
  <meta name="twitter:description" content="${escapeHtml(safeDesc)}" />
${ogImage ? `  <meta name="twitter:image" content="${ogImage}" />\n` : ''}\
${hreflangTags}
</head>`;
}

// ═══════════════════════════════════════════════════════════════════════════
// HREFLANG BUILDER
// ═══════════════════════════════════════════════════════════════════════════

export function buildHreflangTags(entries: HreflangEntry[]): string {
  if (!entries.length) return '';
  const tags = entries
    .map((e) => `  <link rel="alternate" hreflang="${e.lang}" href="${e.url}" />`)
    .join('\n');
  // Always include x-default pointing to PT
  const ptEntry = entries.find((e) => e.lang.startsWith('pt'));
  const xDefault = ptEntry
    ? `  <link rel="alternate" hreflang="x-default" href="${ptEntry.url}" />`
    : '';
  return [tags, xDefault].filter(Boolean).join('\n');
}

export function buildDefaultHreflangEntries(
  baseUrl: string,
  slug: string
): HreflangEntry[] {
  return [
    { lang: 'pt-BR', url: `${baseUrl}/blog/${slug}` },
    { lang: 'en', url: `${baseUrl}/en/blog/${slug}` },
    { lang: 'es', url: `${baseUrl}/es/blog/${slug}` },
  ];
}

// ═══════════════════════════════════════════════════════════════════════════
// GEO CONTEXT BLOCK (for generative crawlers)
// ═══════════════════════════════════════════════════════════════════════════

export function buildGeoContextBlock(params: {
  productName: string;
  category: string;
  manufacturer?: string;
  country?: string;
}): string {
  const { productName, category, manufacturer = 'SmartDent', country = 'Brasil' } = params;
  return `<div class="geo-context" aria-hidden="true" style="display:none;"
  data-product="${escapeAttr(productName)}"
  data-category="${escapeAttr(category)}"
  data-manufacturer="${escapeAttr(manufacturer)}"
  data-country="${escapeAttr(country)}"
  data-language="pt-BR"
  data-region="São Paulo, SP, Brasil"
  data-market="odontologia digital"
></div>`;
}

// ═══════════════════════════════════════════════════════════════════════════
// SPEAKABLE SPECIFICATION
// ═══════════════════════════════════════════════════════════════════════════

export function buildSpeakableSpecification(cssSelectors: string[]): object {
  return {
    '@type': 'SpeakableSpecification',
    cssSelector: cssSelectors,
  };
}

export const DEFAULT_SPEAKABLE_SELECTORS = [
  '.article-summary',
  'h1',
  '.key-benefits',
  '.product-description',
];

// ═══════════════════════════════════════════════════════════════════════════
// PERFORMANCE CSS
// ═══════════════════════════════════════════════════════════════════════════

export const PERFORMANCE_CSS = `
/* Critical CSS — font-display: swap, contain, will-change */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');

*, *::before, *::after { box-sizing: border-box; }

body {
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  font-display: swap;
  line-height: 1.6;
  color: #1a1a2e;
  margin: 0;
}

img {
  max-width: 100%;
  height: auto;
  display: block;
}

.lcp-image {
  content-visibility: auto;
  contain-intrinsic-size: 800px 450px;
}

/* Layout */
main { max-width: 860px; margin: 0 auto; padding: 1.5rem; }
article { contain: content; }
section { margin-bottom: 2rem; }

/* Typography */
h1 { font-size: 2rem; font-weight: 700; line-height: 1.2; margin-bottom: 1rem; }
h2 { font-size: 1.5rem; font-weight: 600; margin-top: 2rem; margin-bottom: 0.75rem; }
h3 { font-size: 1.2rem; font-weight: 600; margin-top: 1.5rem; margin-bottom: 0.5rem; }

/* Utility */
.visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0,0,0,0); }
.geo-context { display: none !important; }
`;

// ═══════════════════════════════════════════════════════════════════════════
// IMAGE TAG BUILDER
// ═══════════════════════════════════════════════════════════════════════════

export function buildImageTag(opts: ImageTagOptions): string {
  const { src, alt, width, height, isLCP = false, cssClass = '' } = opts;
  const loading = isLCP ? 'eager' : 'lazy';
  const fetchPriority = isLCP ? ' fetchpriority="high"' : '';
  const classAttr = cssClass ? ` class="${cssClass}${isLCP ? ' lcp-image' : ''}"` : (isLCP ? ' class="lcp-image"' : '');

  return `<img src="${src}" alt="${escapeAttr(alt)}" width="${width}" height="${height}" loading="${loading}"${fetchPriority}${classAttr} />`;
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function escapeAttr(str: string): string {
  return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function getSiteBaseUrl(): string {
  return Deno.env.get('SITE_BASE_URL') || 'https://smartdent.com.br';
}
