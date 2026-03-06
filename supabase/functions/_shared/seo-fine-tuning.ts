// ═══════════════════════════════════════════════════════════
// SEO FINE-TUNING — GEO / hreflang / SpeakableSpec / canonical
// Helpers para construir <head> completo e blocos GEO.
// ═══════════════════════════════════════════════════════════

export interface HreflangEntry {
  lang: string; // e.g. "pt-BR"
  href: string; // absolute URL
}

export interface SeoHeadOptions {
  title: string;
  metaDescription: string;
  canonicalUrl: string;
  hreflangEntries?: HreflangEntry[];
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogType?: "article" | "website" | "product";
  robots?: string;
  /** Extra <link> / <meta> tags to append verbatim */
  extraHead?: string;
}

export interface ImageTagOptions {
  src: string;
  alt: string;
  width: number;
  height: number;
  /** true = first/hero image (LCP). Adds fetchpriority="high" + loading="eager" */
  isLCP?: boolean;
  cssClass?: string;
  title?: string;
}

// ───────────────────────────────────────────────────────────
// TITLE / META VALIDATION
// ───────────────────────────────────────────────────────────

const TITLE_MAX = 60;
const META_MAX = 160;

export function validateTitle(title: string): string {
  if (title.length > TITLE_MAX) {
    console.warn(`[SEO] Title too long (${title.length}/${TITLE_MAX}): "${title}"`);
  }
  return title;
}

export function validateMetaDescription(desc: string): string {
  if (desc.length > META_MAX) {
    console.warn(`[SEO] Meta description too long (${desc.length}/${META_MAX})`);
  }
  return desc;
}

// ───────────────────────────────────────────────────────────
// HREFLANG
// ───────────────────────────────────────────────────────────

/**
 * Builds hreflang <link> tags including x-default.
 * x-default always points to the PT-BR canonical.
 */
export function buildHreflangTags(entries: HreflangEntry[]): string {
  const tags = entries
    .map((e) => `  <link rel="alternate" hreflang="${e.lang}" href="${e.href}" />`)
    .join("\n");

  // x-default = first entry (pt-BR canonical)
  const xDefault = entries[0]?.href ?? "";
  return tags + `\n  <link rel="alternate" hreflang="x-default" href="${xDefault}" />`;
}

/**
 * Generates the default hreflang set (pt-BR / en / es) from a base canonical URL.
 * Assumes URL pattern: /base-path/slug  →  /en/base-path/slug  →  /es/base-path/slug
 */
export function buildDefaultHreflangEntries(
  canonicalUrl: string,
  basePath: string,
  slug: string,
  baseUrl: string
): HreflangEntry[] {
  return [
    { lang: "pt-BR", href: `${baseUrl}${basePath}/${slug}` },
    { lang: "en", href: `${baseUrl}/en${basePath}/${slug}` },
    { lang: "es", href: `${baseUrl}/es${basePath}/${slug}` },
  ];
}

// ───────────────────────────────────────────────────────────
// SEO HEAD BUILDER
// ───────────────────────────────────────────────────────────

export function buildSeoHead(opts: SeoHeadOptions): string {
  const title = validateTitle(opts.title);
  const metaDesc = validateMetaDescription(opts.metaDescription);
  const ogType = opts.ogType ?? "article";
  const robots = opts.robots ?? "index, follow";

  const hreflang = opts.hreflangEntries?.length
    ? "\n" + buildHreflangTags(opts.hreflangEntries)
    : "";

  const ogImage = opts.ogImage
    ? `\n  <meta property="og:image" content="${opts.ogImage}" />`
    : "";

  return `  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(metaDesc)}" />
  <meta name="robots" content="${robots}" />
  <link rel="canonical" href="${opts.canonicalUrl}" />${hreflang}
  <!-- Open Graph -->
  <meta property="og:type" content="${ogType}" />
  <meta property="og:title" content="${escapeHtml(opts.ogTitle ?? title)}" />
  <meta property="og:description" content="${escapeHtml(opts.ogDescription ?? metaDesc)}" />${ogImage}
  <meta property="og:url" content="${opts.canonicalUrl}" />
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(opts.ogTitle ?? title)}" />
  <meta name="twitter:description" content="${escapeHtml(opts.ogDescription ?? metaDesc)}" />${opts.extraHead ? "\n" + opts.extraHead : ""}`;
}

// ───────────────────────────────────────────────────────────
// SPEAKABLE SPECIFICATION (GEO)
// Used by voice assistants and generative AI crawlers
// ───────────────────────────────────────────────────────────

export interface SpeakableConfig {
  cssSelectors: string[];
  canonicalUrl: string;
}

export function buildSpeakableSpecification(config: SpeakableConfig): Record<string, unknown> {
  return {
    "@type": "SpeakableSpecification",
    cssSelector: config.cssSelectors,
    url: config.canonicalUrl,
  };
}

export const DEFAULT_SPEAKABLE_SELECTORS = [
  ".article-summary",
  "h1",
  ".ai-summary-box",
  ".geo-context",
];

// ───────────────────────────────────────────────────────────
// GEO CONTEXT BLOCK (for AI crawlers)
// ───────────────────────────────────────────────────────────

export interface GeoContextData {
  productName: string;
  category: string;
  manufacturer?: string;
  targetKeyword: string;
  locale?: string;
  country?: string;
  region?: string;
}

/**
 * Generates a visually hidden `<div class="geo-context">` block with
 * data-attributes that help generative AI crawlers understand the document context.
 */
export function buildGeoContextBlock(data: GeoContextData): string {
  const locale = data.locale ?? "pt-BR";
  const country = data.country ?? "BR";
  const region = data.region ?? "São Paulo, SP";

  return `<div class="geo-context" aria-hidden="true" style="display:none"
  data-product="${escapeAttr(data.productName)}"
  data-category="${escapeAttr(data.category)}"
  data-manufacturer="${escapeAttr(data.manufacturer ?? "SmartDent")}"
  data-keyword="${escapeAttr(data.targetKeyword)}"
  data-locale="${locale}"
  data-country="${country}"
  data-region="${escapeAttr(region)}"
  data-publisher="SmartDent"
  data-publisher-url="https://smartdent.com.br"
></div>`;
}

// ───────────────────────────────────────────────────────────
// IMAGE BUILDER (Performance / Core Web Vitals)
// ───────────────────────────────────────────────────────────

/**
 * Builds a standards-compliant `<img>` tag with:
 * - mandatory alt text
 * - explicit width + height (prevents CLS)
 * - fetchpriority="high" + loading="eager" for LCP images
 * - loading="lazy" for below-fold images
 */
export function buildImageTag(opts: ImageTagOptions): string {
  const loading = opts.isLCP ? 'loading="eager"' : 'loading="lazy"';
  const fetchpriority = opts.isLCP ? ' fetchpriority="high"' : "";
  const cssClass = opts.cssClass ? ` class="${escapeAttr(opts.cssClass)}"` : "";
  const titleAttr = opts.title ? ` title="${escapeAttr(opts.title)}"` : "";

  return `<img src="${opts.src}" alt="${escapeAttr(opts.alt)}" width="${opts.width}" height="${opts.height}"${cssClass}${titleAttr} ${loading}${fetchpriority} decoding="async" />`;
}

// ───────────────────────────────────────────────────────────
// PERFORMANCE CSS (Critical path)
// ───────────────────────────────────────────────────────────

export const PERFORMANCE_CSS = `
/* font-display: swap prevents FOIT and reduces CLS */
@font-face {
  font-family: 'Inter';
  font-display: swap;
  src: local('Inter');
}

/* Prevent layout shift for images without explicit dimensions */
img {
  max-width: 100%;
  height: auto;
}

/* Below-fold images: GPU-hint for smoother lazy-loading */
img[loading="lazy"] {
  content-visibility: auto;
}
`.trim();

// ───────────────────────────────────────────────────────────
// UTILS
// ───────────────────────────────────────────────────────────

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function escapeAttr(str: string): string {
  return str.replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}
