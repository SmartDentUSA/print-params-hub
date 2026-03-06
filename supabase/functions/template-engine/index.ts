// ═══════════════════════════════════════════════════════════
// TEMPLATE ENGINE — Motor HTML Completo
// Monta documentos HTML com <head> SEO-completo, JSON-LD,
// CSS crítico, SpeakableSpec, geo-context e scoring 0-10.
// ═══════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  buildSeoHead,
  buildGeoContextBlock,
  PERFORMANCE_CSS,
  escapeHtml,
  type SeoHeadOptions,
  type GeoContextData,
} from "../_shared/seo-fine-tuning.ts";
import {
  SMARTDENT_COMPANY,
  type PersonSchema,
  type CompanySchema,
} from "../_shared/authority-data-helper.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ───────────────────────────────────────────────────────────
// TYPES
// ───────────────────────────────────────────────────────────

export interface TemplateInput {
  seo: SeoHeadOptions;
  geoContext: GeoContextData;
  jsonLdGraphNodes: Record<string, unknown>[];
  /** HTML body content — should use semantic HTML5 (article, main, section) */
  bodyHtml: string;
  /** Additional inline CSS to append to the critical CSS block */
  extraCss?: string;
  /** Page language. Defaults to "pt-BR" */
  lang?: string;
}

export interface TemplateOutput {
  html: string;
  stats: DocumentStats;
}

export interface DocumentStats {
  /** Estimated score 0-10 across all dimensions */
  score: number;
  dimensions: {
    seo: number;
    geo: number;
    eeat: number;
    aiReadiness: number;
    performance: number;
  };
  warnings: string[];
  byteSize: number;
}

// ───────────────────────────────────────────────────────────
// SCORING HELPERS
// ───────────────────────────────────────────────────────────

function scoreSeo(html: string): { score: number; warnings: string[] } {
  const warnings: string[] = [];
  let score = 0;

  if (html.includes("<title>")) score += 2;
  else warnings.push("CRITICO: Sem <title>");

  if (html.includes('name="description"')) score += 2;
  else warnings.push("CRITICO: Sem meta description");

  if (html.includes('rel="canonical"')) score += 2;
  else warnings.push("CRITICO: Sem canonical URL");

  if (html.includes("hreflang")) score += 1;
  else warnings.push("ALTO: Sem hreflang");

  const h1Count = (html.match(/<h1[\s>]/gi) || []).length;
  if (h1Count === 1) score += 2;
  else if (h1Count === 0) warnings.push("CRITICO: H1 ausente");
  else warnings.push(`ALTO: ${h1Count} H1 encontrados (deve ser exatamente 1)`);

  if (html.includes('property="og:title"')) score += 1;
  else warnings.push("MEDIO: Sem Open Graph tags");

  return { score: Math.min(score, 10), warnings };
}

function scoreGeo(html: string, jsonLd: string): { score: number; warnings: string[] } {
  const warnings: string[] = [];
  let score = 0;

  if (html.includes("geo-context")) score += 2;
  else warnings.push("CRITICO: Sem bloco geo-context");

  if (jsonLd.includes("SpeakableSpecification")) score += 3;
  else warnings.push("CRITICO: Sem SpeakableSpecification");

  if (jsonLd.includes("LocalBusiness")) score += 2;
  else warnings.push("ALTO: Sem schema LocalBusiness");

  if (jsonLd.includes("GeoCoordinates")) score += 2;
  else warnings.push("ALTO: Sem GeoCoordinates");

  if (html.includes("hreflang")) score += 1;

  return { score: Math.min(score, 10), warnings };
}

function scoreEEAT(jsonLd: string): { score: number; warnings: string[] } {
  const warnings: string[] = [];
  let score = 0;

  if (jsonLd.includes('"Person"')) score += 2;
  else warnings.push("CRITICO: Sem schema Person (autor)");

  if (jsonLd.includes("hasCredential")) score += 2;
  else warnings.push("ALTO: Sem hasCredential no autor");

  if (jsonLd.includes("sameAs")) score += 1;
  else warnings.push("MEDIO: Sem sameAs no autor");

  if (jsonLd.includes("AggregateRating")) score += 2;
  else warnings.push("MEDIO: Sem AggregateRating");

  if (jsonLd.includes("hasCertification") || jsonLd.includes("ANVISA") || jsonLd.includes("ISO")) score += 2;
  else warnings.push("MEDIO: Sem certificações na organização");

  if (jsonLd.includes("foundingDate")) score += 1;

  return { score: Math.min(score, 10), warnings };
}

function scoreAIReadiness(html: string, jsonLd: string): { score: number; warnings: string[] } {
  const warnings: string[] = [];
  let score = 0;

  if (jsonLd.includes('"about"')) score += 2;
  else warnings.push("CRITICO: Sem campo 'about' no JSON-LD");

  if (jsonLd.includes('"mentions"')) score += 2;
  else warnings.push("CRITICO: Sem campo 'mentions' no JSON-LD");

  if (jsonLd.includes("mainEntityOfPage")) score += 2;
  else warnings.push("ALTO: Sem mainEntityOfPage");

  if (html.includes("<article")) score += 1;
  else warnings.push("MEDIO: Sem tag <article>");

  if (html.includes("<main")) score += 1;
  else warnings.push("MEDIO: Sem tag <main>");

  if (jsonLd.includes("FAQPage")) score += 1;
  else warnings.push("MEDIO: Sem FAQPage schema");

  if (html.includes("<section")) score += 1;

  return { score: Math.min(score, 10), warnings };
}

function scorePerformance(html: string): { score: number; warnings: string[] } {
  const warnings: string[] = [];
  let score = 0;

  if (html.includes("font-display")) score += 2;
  else warnings.push("ALTO: Sem font-display:swap");

  if (html.includes('fetchpriority="high"')) score += 2;
  else warnings.push("ALTO: Sem fetchpriority=high na imagem LCP");

  if (html.includes('loading="lazy"')) score += 2;
  else warnings.push("MEDIO: Sem lazy loading em imagens below-fold");

  if (!html.includes("base64")) score += 2;
  else warnings.push("ALTO: base64 inline detectado");

  // Check images for explicit width/height
  const imgTags = html.match(/<img[^>]+>/gi) || [];
  const imgsMissingDimensions = imgTags.filter(
    (t) => !t.includes("width=") || !t.includes("height=")
  );
  if (imgsMissingDimensions.length === 0) score += 2;
  else warnings.push(`ALTO: ${imgsMissingDimensions.length} imagem(ns) sem width/height explícito`);

  return { score: Math.min(score, 10), warnings };
}

// ───────────────────────────────────────────────────────────
// DOCUMENT BUILDER
// ───────────────────────────────────────────────────────────

export function buildDocument(input: TemplateInput): TemplateOutput {
  const lang = input.lang ?? "pt-BR";

  // Serialize JSON-LD
  const jsonLdPayload = {
    "@context": "https://schema.org",
    "@graph": input.jsonLdGraphNodes,
  };
  const jsonLdString = JSON.stringify(jsonLdPayload, null, 2);

  const headHtml = buildSeoHead(input.seo);
  const geoBlock = buildGeoContextBlock(input.geoContext);

  const css = [PERFORMANCE_CSS, input.extraCss].filter(Boolean).join("\n\n");

  const html = `<!DOCTYPE html>
<html lang="${lang}">
<head>
${headHtml}
  <style>
${css}
  </style>
  <script type="application/ld+json">
${jsonLdString}
  </script>
</head>
<body>
${geoBlock}
${input.bodyHtml}
</body>
</html>`;

  // ─── Scoring ───
  const seoResult = scoreSeo(html);
  const geoResult = scoreGeo(html, jsonLdString);
  const eeatResult = scoreEEAT(jsonLdString);
  const aiResult = scoreAIReadiness(html, jsonLdString);
  const perfResult = scorePerformance(html);

  const avg =
    (seoResult.score + geoResult.score + eeatResult.score + aiResult.score + perfResult.score) / 5;

  const stats: DocumentStats = {
    score: Math.round(avg * 10) / 10,
    dimensions: {
      seo: seoResult.score,
      geo: geoResult.score,
      eeat: eeatResult.score,
      aiReadiness: aiResult.score,
      performance: perfResult.score,
    },
    warnings: [
      ...seoResult.warnings,
      ...geoResult.warnings,
      ...eeatResult.warnings,
      ...aiResult.warnings,
      ...perfResult.warnings,
    ],
    byteSize: new TextEncoder().encode(html).length,
  };

  return { html, stats };
}

// ───────────────────────────────────────────────────────────
// JSON-LD HELPERS
// ───────────────────────────────────────────────────────────

export function buildBreadcrumbList(
  items: { name: string; url: string }[]
): Record<string, unknown> {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function buildFAQSchema(
  faqs: { question: string; answer: string }[]
): Record<string, unknown> {
  return {
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };
}

export function buildHowToSchema(
  name: string,
  description: string,
  steps: { name: string; text: string; image?: string }[]
): Record<string, unknown> {
  return {
    "@type": "HowTo",
    name,
    description,
    step: steps.map((s, idx) => ({
      "@type": "HowToStep",
      position: idx + 1,
      name: s.name,
      text: s.text,
      ...(s.image ? { image: s.image } : {}),
    })),
  };
}

export function buildOrganizationNode(company: CompanySchema): Record<string, unknown> {
  return company as unknown as Record<string, unknown>;
}

export function buildPersonNode(person: PersonSchema): Record<string, unknown> {
  return person as unknown as Record<string, unknown>;
}

// ───────────────────────────────────────────────────────────
// HTTP HANDLER (utility endpoint — returns scored HTML)
// ───────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const input: TemplateInput = await req.json();
    const output = buildDocument(input);

    return new Response(JSON.stringify(output), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
