// ═══════════════════════════════════════════════════════════════════════════
// TEMPLATE ENGINE
// Assembles complete HTML documents with:
//   - Full <head> (SEO meta, hreflang, canonical, OG, Twitter Card)
//   - JSON-LD structured data (injected before </body>)
//   - HTML5 semantic shell (<article><main>…</main></article>)
//   - Performance attributes (font-display: swap, lazy loading, fetchpriority)
//   - geo-context block for GEO / AI crawlers
//
// Input: POST { type, articleHtml, jsonLd, meta, options }
// Output: { html: string, stats: { … } }
// ═══════════════════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  buildSeoHead,
  buildJsonLdScript,
  buildHreflangTags,
  buildGeoContextBlock,
  buildSpeakableSpecification,
  PERFORMANCE_CSS,
  escapeHtml,
  escapeAttr,
  type SeoHeadOptions,
  type HreflangEntry,
} from "../_shared/seo-fine-tuning.ts";
import {
  SMARTDENT_COMPANY,
  buildBreadcrumbList,
  type BreadcrumbItem,
} from "../_shared/authority-data-helper.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── Request Types ─────────────────────────────────────────────────────────────

interface TemplateRequest {
  type: "article" | "product-blog" | "spin-landing-page" | "parameter-page";
  articleHtml: string;
  jsonLd: object[];
  meta: {
    title: string;
    description: string;
    keywords?: string[];
    ogTitle?: string;
    ogDescription?: string;
    ogImage?: string;
    canonicalUrl: string;
    locale?: "pt-BR" | "en-US" | "es-ES";
    articlePublishedTime?: string;
    articleModifiedTime?: string;
    articleAuthor?: string;
    articleSection?: string;
  };
  options?: {
    hreflangUrls?: HreflangEntry[];
    breadcrumbs?: BreadcrumbItem[];
    geoContextKeywords?: string[];
    includeLocalBusiness?: boolean;
    includeSpeakable?: boolean;
    lcpImageSrc?: string;
    robots?: string;
  };
}

// ─── HTML Document Assembly ────────────────────────────────────────────────────

function assembleDocument(req: TemplateRequest): string {
  const opts = req.options ?? {};
  const locale = req.meta.locale ?? "pt-BR";
  const lang = locale.split("-")[0]; // "pt", "en", "es"

  // Build full set of JSON-LD schemas
  const allSchemas: object[] = [...req.jsonLd];

  // Always include SmartDent Organisation
  if (opts.includeLocalBusiness !== false) {
    allSchemas.push({ "@context": "https://schema.org", ...SMARTDENT_COMPANY });
  }

  // BreadcrumbList
  if (opts.breadcrumbs && opts.breadcrumbs.length > 0) {
    allSchemas.push({
      "@context": "https://schema.org",
      ...buildBreadcrumbList(opts.breadcrumbs),
    });
  }

  // SpeakableSpecification — inject into first Article/WebPage schema
  if (opts.includeSpeakable !== false) {
    const speakable = buildSpeakableSpecification([
      "#article-summary",
      ".speakable-intro",
      "h1",
      "h2",
    ]);
    const articleSchema = allSchemas.find(
      (s: any) =>
        s["@type"] === "Article" ||
        s["@type"] === "BlogPosting" ||
        s["@type"] === "WebPage"
    ) as any;
    if (articleSchema) {
      articleSchema.speakable = speakable;
    }
  }

  // Build SEO head options
  const seoOpts: SeoHeadOptions = {
    title: req.meta.title,
    metaDescription: req.meta.description,
    canonicalUrl: req.meta.canonicalUrl,
    locale: locale as "pt-BR" | "en-US" | "es-ES",
    ogTitle: req.meta.ogTitle,
    ogDescription: req.meta.ogDescription,
    ogImage: req.meta.ogImage,
    ogType: req.type === "spin-landing-page" ? "website" : "article",
    keywords: req.meta.keywords,
    hreflangUrls: opts.hreflangUrls,
    articlePublishedTime: req.meta.articlePublishedTime,
    articleModifiedTime: req.meta.articleModifiedTime,
    articleAuthor: req.meta.articleAuthor,
    articleSection: req.meta.articleSection,
    robots: opts.robots,
  };

  const seoHead = buildSeoHead(seoOpts);
  const jsonLdScripts = buildJsonLdScript(allSchemas);

  // geo-context block
  const geoContext = buildGeoContextBlock({
    entityName: "SmartDent",
    entityType: "Distribuidora de Soluções Odontológicas Digitais",
    locale,
    topicKeywords: opts.geoContextKeywords ?? [
      "odontologia digital",
      "impressão 3D odontológica",
      "resinas fotopolimerizáveis",
      "scanners intraorais",
      "CAD/CAM odontológico",
    ],
    authoritative: true,
  });

  // LCP image preload
  const lcpPreload = opts.lcpImageSrc
    ? `  <link rel="preload" as="image" href="${escapeAttr(opts.lcpImageSrc)}" fetchpriority="high" />`
    : "";

  const document = `<!DOCTYPE html>
<html lang="${lang}" dir="ltr">
<head>
${seoHead}
${lcpPreload}

  <!-- ═══ Critical CSS ═══ -->
  <style>
${PERFORMANCE_CSS}
  </style>
</head>
<body>
  <!-- ═══ GEO Context (AI crawler hint) ═══ -->
  ${geoContext}

  <!-- ═══ Main Content ═══ -->
  ${req.articleHtml}

  <!-- ═══ JSON-LD Structured Data ═══ -->
  ${jsonLdScripts}
</body>
</html>`;

  return document;
}

// ─── Document Stats ────────────────────────────────────────────────────────────

function computeStats(html: string) {
  const h1Count = (html.match(/<h1[^>]*>/gi) ?? []).length;
  const h2Count = (html.match(/<h2[^>]*>/gi) ?? []).length;
  const h3Count = (html.match(/<h3[^>]*>/gi) ?? []).length;
  const imgCount = (html.match(/<img[^>]*>/gi) ?? []).length;
  const imgWithAlt = (html.match(/<img[^>]+alt="[^"]+"/gi) ?? []).length;
  const imgLazy = (html.match(/loading="lazy"/gi) ?? []).length;
  const imgLCP = (html.match(/fetchpriority="high"/gi) ?? []).length;
  const hasCanonical = html.includes('rel="canonical"');
  const hasJsonLd = html.includes('type="application/ld+json"');
  const hasHreflang = html.includes('rel="alternate"');
  const hasGeoContext = html.includes('id="geo-context"');
  const hasSpeakable = html.includes("SpeakableSpecification");
  const hasLocalBusiness = html.includes("LocalBusiness");
  const hasPersonSchema = html.includes('"Person"');
  const hasFAQPage = html.includes("FAQPage");
  const hasArticleSchema = html.includes('"Article"') || html.includes('"BlogPosting"');
  const hasMainEntity = html.includes("mainEntityOfPage");
  const hasFontSwap = html.includes("font-display: swap");
  const htmlSizeKb = Math.round(html.length / 1024);

  // Score calculation
  const checks = [
    h1Count === 1,
    h2Count >= 2,
    imgWithAlt === imgCount,
    hasCanonical,
    hasJsonLd,
    hasHreflang,
    hasGeoContext,
    hasSpeakable,
    hasLocalBusiness,
    hasPersonSchema,
    hasFAQPage,
    hasArticleSchema,
    hasMainEntity,
    hasFontSwap,
    imgLCP >= 1,
    htmlSizeKb < 200,
  ];

  const score = Math.round((checks.filter(Boolean).length / checks.length) * 10);

  return {
    score,
    htmlSizeKb,
    headings: { h1: h1Count, h2: h2Count, h3: h3Count },
    images: {
      total: imgCount,
      withAlt: imgWithAlt,
      lazy: imgLazy,
      lcp: imgLCP,
    },
    seo: { hasCanonical, hasJsonLd, hasHreflang },
    geo: { hasGeoContext, hasSpeakable, hasLocalBusiness },
    eeat: { hasPersonSchema, hasFAQPage },
    aiReadiness: { hasArticleSchema, hasMainEntity },
    performance: { hasFontSwap, lcpOptimized: imgLCP >= 1 },
    warnings: [
      h1Count !== 1 && `H1 count is ${h1Count} (expected 1)`,
      imgWithAlt < imgCount && `${imgCount - imgWithAlt} image(s) missing alt text`,
      !hasCanonical && "Missing canonical URL",
      !hasHreflang && "Missing hreflang tags",
      !hasGeoContext && "Missing geo-context block",
      !hasSpeakable && "Missing SpeakableSpecification",
      !hasPersonSchema && "Missing Person schema (E-E-A-T)",
      !hasFontSwap && "Missing font-display: swap",
      imgLCP === 0 && "No LCP image with fetchpriority=high",
      htmlSizeKb > 200 && `HTML is large: ${htmlSizeKb}KB (recommend <200KB)`,
    ].filter(Boolean),
  };
}

// ─── HTTP Handler ──────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: TemplateRequest = await req.json();

    if (!body.articleHtml) throw new Error("articleHtml is required");
    if (!body.meta?.title) throw new Error("meta.title is required");
    if (!body.meta?.description) throw new Error("meta.description is required");
    if (!body.meta?.canonicalUrl) throw new Error("meta.canonicalUrl is required");

    const html = assembleDocument(body);
    const stats = computeStats(html);

    console.log(
      `[template-engine] type=${body.type} size=${stats.htmlSizeKb}KB score=${stats.score}/10 warnings=${stats.warnings.length}`
    );

    return new Response(
      JSON.stringify({
        success: true,
        html,
        stats,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[template-engine] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
