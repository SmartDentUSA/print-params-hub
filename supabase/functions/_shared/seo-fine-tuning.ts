// ═══════════════════════════════════════════════════════════════════════════
// SEO FINE-TUNING MODULE
// Handles: title validation, meta description, canonical URL, hreflang,
// SpeakableSpecification, geo-context block, and structured data helpers.
// ═══════════════════════════════════════════════════════════════════════════

export interface SeoHeadOptions {
  title: string;
  metaDescription: string;
  canonicalUrl: string;
  locale?: "pt-BR" | "en-US" | "es-ES";
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogType?: "article" | "website" | "product";
  twitterCard?: "summary" | "summary_large_image";
  robots?: string;
  hreflangUrls?: HreflangEntry[];
  articlePublishedTime?: string;
  articleModifiedTime?: string;
  articleAuthor?: string;
  articleSection?: string;
  keywords?: string[];
}

export interface HreflangEntry {
  lang: "pt-BR" | "en-US" | "es-ES" | "x-default";
  url: string;
}

// ─── Title Tag Validation ─────────────────────────────────────────────────────

export function validateTitle(title: string): { valid: boolean; length: number; warning?: string } {
  const len = title.length;
  if (len < 30) return { valid: false, length: len, warning: "Title too short (<30 chars)" };
  if (len > 60) return { valid: false, length: len, warning: `Title too long (${len} > 60 chars)` };
  return { valid: true, length: len };
}

export function truncateTitle(title: string, maxLen = 60): string {
  if (title.length <= maxLen) return title;
  const truncated = title.substring(0, maxLen - 3);
  const lastSpace = truncated.lastIndexOf(" ");
  return (lastSpace > 30 ? truncated.substring(0, lastSpace) : truncated) + "...";
}

// ─── Meta Description Validation ─────────────────────────────────────────────

export function validateMetaDescription(desc: string): { valid: boolean; length: number; warning?: string } {
  const len = desc.length;
  if (len < 70) return { valid: false, length: len, warning: "Meta description too short (<70 chars)" };
  if (len > 160) return { valid: false, length: len, warning: `Meta description too long (${len} > 160 chars)` };
  return { valid: true, length: len };
}

export function truncateMetaDescription(desc: string, maxLen = 160): string {
  if (desc.length <= maxLen) return desc;
  const truncated = desc.substring(0, maxLen - 3);
  const lastSpace = truncated.lastIndexOf(" ");
  return (lastSpace > 70 ? truncated.substring(0, lastSpace) : truncated) + "...";
}

// ─── hreflang Tags ────────────────────────────────────────────────────────────

export function buildHreflangTags(entries: HreflangEntry[]): string {
  return entries
    .map(
      (e) =>
        `  <link rel="alternate" hreflang="${e.lang}" href="${escapeAttr(e.url)}" />`
    )
    .join("\n");
}

export function buildDefaultHreflangEntries(
  baseUrl: string,
  slug: string
): HreflangEntry[] {
  return [
    { lang: "pt-BR", url: `${baseUrl}/pt/${slug}` },
    { lang: "en-US", url: `${baseUrl}/en/${slug}` },
    { lang: "es-ES", url: `${baseUrl}/es/${slug}` },
    { lang: "x-default", url: `${baseUrl}/pt/${slug}` },
  ];
}

// ─── SpeakableSpecification (GEO) ────────────────────────────────────────────

export function buildSpeakableSpecification(cssSelectors: string[] = []) {
  const selectors =
    cssSelectors.length > 0
      ? cssSelectors
      : ["#article-summary", ".speakable-intro", "h1", "h2"];
  return {
    "@type": "SpeakableSpecification",
    cssSelector: selectors,
  };
}

// ─── geo-context Block (GEO / AI crawler hint) ───────────────────────────────

export function buildGeoContextBlock(opts: {
  entityName: string;
  entityType: string;
  locale: string;
  topicKeywords: string[];
  authoritative: boolean;
}): string {
  return `
<div id="geo-context" aria-hidden="true" style="display:none" itemscope itemtype="https://schema.org/WebPageElement">
  <meta itemprop="name" content="${escapeAttr(opts.entityName)}" />
  <meta itemprop="description" content="${escapeAttr(opts.entityType)}" />
  <meta itemprop="inLanguage" content="${escapeAttr(opts.locale)}" />
  <meta itemprop="keywords" content="${escapeAttr(opts.topicKeywords.join(", "))}" />
  ${opts.authoritative ? '<meta itemprop="isPartOf" content="https://smartdent.com.br" />' : ""}
</div>`.trim();
}

// ─── Full <head> Generator ────────────────────────────────────────────────────

export function buildSeoHead(opts: SeoHeadOptions): string {
  const title = truncateTitle(opts.title);
  const desc = truncateMetaDescription(opts.metaDescription);
  const locale = opts.locale ?? "pt-BR";
  const ogType = opts.ogType ?? "article";
  const twitterCard = opts.twitterCard ?? "summary_large_image";
  const robots = opts.robots ?? "index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1";

  const hreflangBlock = opts.hreflangUrls
    ? buildHreflangTags(opts.hreflangUrls)
    : "";

  const ogImageTag = opts.ogImage
    ? `  <meta property="og:image" content="${escapeAttr(opts.ogImage)}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:image" content="${escapeAttr(opts.ogImage)}" />`
    : "";

  const articleMeta =
    ogType === "article"
      ? `
  <meta property="article:published_time" content="${opts.articlePublishedTime ?? new Date().toISOString()}" />
  <meta property="article:modified_time" content="${opts.articleModifiedTime ?? new Date().toISOString()}" />
  ${opts.articleAuthor ? `<meta property="article:author" content="${escapeAttr(opts.articleAuthor)}" />` : ""}
  ${opts.articleSection ? `<meta property="article:section" content="${escapeAttr(opts.articleSection)}" />` : ""}`
      : "";

  const keywordsMeta =
    opts.keywords && opts.keywords.length > 0
      ? `  <meta name="keywords" content="${escapeAttr(opts.keywords.join(", "))}" />`
      : "";

  return `  <!-- ═══ SEO Core ═══ -->
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeAttr(desc)}" />
  <link rel="canonical" href="${escapeAttr(opts.canonicalUrl)}" />
  <meta name="robots" content="${escapeAttr(robots)}" />
  ${keywordsMeta}

  <!-- ═══ Open Graph ═══ -->
  <meta property="og:type" content="${ogType}" />
  <meta property="og:title" content="${escapeAttr(opts.ogTitle ?? title)}" />
  <meta property="og:description" content="${escapeAttr(opts.ogDescription ?? desc)}" />
  <meta property="og:url" content="${escapeAttr(opts.canonicalUrl)}" />
  <meta property="og:locale" content="${locale.replace("-", "_")}" />
  <meta property="og:site_name" content="SmartDent" />
  ${ogImageTag}${articleMeta}

  <!-- ═══ Twitter Card ═══ -->
  <meta name="twitter:card" content="${twitterCard}" />
  <meta name="twitter:title" content="${escapeAttr(opts.ogTitle ?? title)}" />
  <meta name="twitter:description" content="${escapeAttr(opts.ogDescription ?? desc)}" />
  <meta name="twitter:site" content="@smartdentbrasil" />

  <!-- ═══ hreflang / Multilingual ═══ -->
${hreflangBlock}

  <!-- ═══ Performance ═══ -->
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link rel="dns-prefetch" href="https://smartdent.com.br" />`.trim();
}

// ─── JSON-LD <script> Tag ─────────────────────────────────────────────────────

export function buildJsonLdScript(schema: object | object[]): string {
  const schemas = Array.isArray(schema) ? schema : [schema];
  return schemas
    .map(
      (s) =>
        `<script type="application/ld+json">\n${JSON.stringify(s, null, 2)}\n</script>`
    )
    .join("\n");
}

// ─── CSS Performance Block ────────────────────────────────────────────────────

export const PERFORMANCE_CSS = `
/* ── Critical Performance CSS ── */
@font-face {
  font-family: 'Inter';
  font-display: swap;
  src: url('/fonts/inter-var.woff2') format('woff2');
}

img {
  max-width: 100%;
  height: auto;
}

/* Lazy loading placeholder */
img[loading="lazy"] {
  background: #f0f0f0;
}
`.trim();

// ─── Image Tag Builder (with performance attributes) ─────────────────────────

export interface ImageOptions {
  src: string;
  alt: string;
  width: number;
  height: number;
  isLCP?: boolean;
  className?: string;
  fetchpriority?: "high" | "low" | "auto";
}

export function buildImageTag(opts: ImageOptions): string {
  const loading = opts.isLCP ? 'eager' : 'lazy';
  const fetchpriority = opts.isLCP
    ? 'high'
    : (opts.fetchpriority ?? 'auto');
  const decoding = opts.isLCP ? 'sync' : 'async';
  const classAttr = opts.className ? ` class="${escapeAttr(opts.className)}"` : "";

  return `<img
  src="${escapeAttr(opts.src)}"
  alt="${escapeAttr(opts.alt)}"
  width="${opts.width}"
  height="${opts.height}"
  loading="${loading}"
  fetchpriority="${fetchpriority}"
  decoding="${decoding}"${classAttr}
/>`;
}

// ─── Utility Escape Helpers ────────────────────────────────────────────────────

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function escapeAttr(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}
