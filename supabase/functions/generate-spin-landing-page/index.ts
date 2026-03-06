// ═══════════════════════════════════════════════════════════════════════════
// GENERATE SPIN LANDING PAGE
// Generates a full SEO/GEO/E-E-A-T/AI-Ready HTML landing page following the
// SPIN Selling framework: Situation → Problem → Implication → Need-Payoff.
//
// Input: POST {
//   spinData: {
//     situation: string,   — context / market situation
//     problem: string[],   — list of pain points
//     implication: string, — consequences of not solving
//     needPayoff: string,  — solution / value proposition
//   },
//   product: ProductData,
//   authorKey?: string,
//   locale?: "pt-BR" | "en-US" | "es-ES",
//   saveToDb?: boolean,
//   dryRun?: boolean,
//   categoryId?: string,
// }
// ═══════════════════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";
import { logAIUsage, extractUsage } from "../_shared/log-ai-usage.ts";
import { MASTER_SYSTEM_PROMPT, SPIN_PROMPT_EXTENSION } from "../_shared/master-system-prompt.ts";
import {
  SMARTDENT_AUTHORS,
  buildPersonSchema,
  buildAggregateRating,
  buildBreadcrumbList,
} from "../_shared/authority-data-helper.ts";
import {
  buildDefaultHreflangEntries,
  truncateTitle,
  truncateMetaDescription,
} from "../_shared/seo-fine-tuning.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const BASE_URL = Deno.env.get("SITE_BASE_URL") ?? "https://smartdent.com.br";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface SpinData {
  situation: string;
  problem: string[];
  implication: string;
  needPayoff: string;
}

interface ProductData {
  name: string;
  slug: string;
  description: string;
  category: string;
  brand?: string;
  sku?: string;
  price?: number;
  currency?: string;
  imageUrl?: string;
  features?: string[];
  technicalSpecs?: Record<string, string>;
  certifications?: string[];
  ratingValue?: number;
  reviewCount?: number;
  inStock?: boolean;
  productUrl?: string;
  howToSteps?: { name: string; text: string; image?: string }[];
}

interface SpinLandingPageRequest {
  spinData: SpinData;
  product: ProductData;
  authorKey?: string;
  locale?: "pt-BR" | "en-US" | "es-ES";
  saveToDb?: boolean;
  dryRun?: boolean;
  categoryId?: string;
}

// ─── AI Generation ─────────────────────────────────────────────────────────────

async function generateSpinLPWithAI(
  spin: SpinData,
  product: ProductData,
  locale: string
): Promise<{
  articleHtml: string;
  jsonLd: object[];
  meta: {
    title: string;
    description: string;
    keywords: string[];
    ogTitle: string;
    ogDescription: string;
  };
  faqs: { question: string; answer: string }[];
}> {
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

  const localeLabel =
    locale === "pt-BR" ? "português" : locale === "en-US" ? "inglês" : "espanhol";

  const problemsBlock = spin.problem.map((p, i) => `${i + 1}. ${p}`).join("\n");

  const specsBlock =
    product.technicalSpecs && Object.keys(product.technicalSpecs).length > 0
      ? Object.entries(product.technicalSpecs)
          .map(([k, v]) => `- ${k}: ${v}`)
          .join("\n")
      : "";

  const howToBlock = product.howToSteps?.length
    ? product.howToSteps.map((s, i) => `Passo ${i + 1} — ${s.name}: ${s.text}`).join("\n")
    : "";

  const userPrompt = `Gere uma landing page SPIN Selling completa em ${localeLabel} para o produto abaixo.

── DADOS SPIN ──
SITUAÇÃO: ${spin.situation}

PROBLEMAS:
${problemsBlock}

IMPLICAÇÃO: ${spin.implication}

SOLUÇÃO / NEED-PAYOFF: ${spin.needPayoff}

── DADOS DO PRODUTO ──
PRODUTO: ${product.name}
CATEGORIA: ${product.category}
${product.brand ? `MARCA: ${product.brand}` : ""}
DESCRIÇÃO: ${product.description}
${product.features?.length ? `\nCARACTERÍSTICAS:\n${product.features.map((f) => `- ${f}`).join("\n")}` : ""}
${specsBlock ? `\nESPECIFICAÇÕES:\n${specsBlock}` : ""}
${howToBlock ? `\nFLUXO DE USO:\n${howToBlock}` : ""}
${product.certifications?.length ? `\nCERTIFICAÇÕES: ${product.certifications.join(", ")}` : ""}
${product.ratingValue ? `AVALIAÇÃO: ${product.ratingValue}/5 (${product.reviewCount} avaliações)` : ""}

── ESTRUTURA OBRIGATÓRIA DO articleHtml ──
1. <section id="hero"> — H1 + resumo speakable em #article-summary
2. <section id="situation"> — H2 "O Cenário Atual" + contexto de mercado
3. <section id="problems"> — H2 "Os Desafios" + grid de pain points (benefit-card por problema)
4. <section id="implication"> — H2 "O Custo de Não Agir" + consequências
5. <section id="solution"> — H2 com nome do produto + benefícios + specs
6. <section id="how-it-works"> — H2 "Como Funciona" + passos (se howToSteps disponível)
7. <section id="social-proof"> — H2 "Resultados" + dados de avaliação (se disponível)
8. <section id="faq"> — H2 "Perguntas Frequentes" + min. 5 pares Q&A
9. <section id="cta"> — CTA principal com link para ${product.productUrl ?? BASE_URL + "/produtos/" + product.slug}

RETORNE o JSON no formato especificado no system prompt.
No jsonLd inclua: Product (com Offer${product.ratingValue ? " e AggregateRating" : ""}), HowTo (se houver passos), FAQPage.
No meta defina title (máx 60 chars), description (máx 160 chars) e 8-12 keywords.`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: MASTER_SYSTEM_PROMPT + "\n\n" + SPIN_PROMPT_EXTENSION },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.4,
      max_tokens: 14000,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    if (response.status === 429) throw new Error("Rate limit exceeded. Please retry.");
    if (response.status === 402) throw new Error("Lovable AI credits exhausted.");
    throw new Error(`AI API error ${response.status}: ${err}`);
  }

  const aiData = await response.json();
  const usage = extractUsage(aiData);
  await logAIUsage({
    functionName: "generate-spin-landing-page",
    actionLabel: "generate-spin-lp",
    model: "google/gemini-2.5-flash",
    promptTokens: usage.prompt_tokens,
    completionTokens: usage.completion_tokens,
  });

  const raw = aiData.choices?.[0]?.message?.content ?? "";
  const cleaned = raw
    .replace(/^```(?:json)?\s*\n?/m, "")
    .replace(/\n?```\s*$/m, "")
    .trim();

  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("AI did not return valid JSON");

  return JSON.parse(jsonMatch[0]);
}

// ─── Schema.org Builders ───────────────────────────────────────────────────────

function buildProductSchema(product: ProductData, locale: string) {
  const schema: any = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    sku: product.sku,
    brand: product.brand
      ? { "@type": "Brand", name: product.brand }
      : { "@type": "Brand", name: "SmartDent" },
    manufacturer: { "@id": "https://smartdent.com.br/#organization" },
    inLanguage: locale,
  };

  if (product.imageUrl) {
    schema.image = {
      "@type": "ImageObject",
      url: product.imageUrl,
      width: 800,
      height: 600,
    };
  }

  if (product.price !== undefined) {
    schema.offers = {
      "@type": "Offer",
      price: product.price,
      priceCurrency: product.currency ?? "BRL",
      availability:
        product.inStock !== false
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
      seller: { "@id": "https://smartdent.com.br/#organization" },
      url: product.productUrl ?? `${BASE_URL}/produtos/${product.slug}`,
    };
  }

  if (product.ratingValue !== undefined && product.reviewCount !== undefined) {
    schema.aggregateRating = buildAggregateRating({
      ratingValue: product.ratingValue,
      reviewCount: product.reviewCount,
    });
  }

  return schema;
}

function buildHowToSchema(product: ProductData) {
  if (!product.howToSteps?.length) return null;

  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: `Como usar ${product.name}`,
    description: `Fluxo completo de uso do ${product.name} na odontologia digital`,
    tool: product.name,
    step: product.howToSteps.map((step, index) => ({
      "@type": "HowToStep",
      position: index + 1,
      name: step.name,
      text: step.text,
      ...(step.image
        ? { image: { "@type": "ImageObject", url: step.image } }
        : {}),
    })),
  };
}

function buildFAQPageSchema(faqs: { question: string; answer: string }[]) {
  return {
    "@context": "https://schema.org",
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

function buildWebPageSchema(opts: {
  title: string;
  description: string;
  url: string;
  imageUrl?: string;
  locale: string;
  product: ProductData;
  spin: SpinData;
  authorKey: string;
  publishedTime: string;
}) {
  const author = SMARTDENT_AUTHORS[opts.authorKey] ?? SMARTDENT_AUTHORS.default;
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: truncateTitle(opts.title),
    description: truncateMetaDescription(opts.description),
    url: opts.url,
    inLanguage: opts.locale,
    datePublished: opts.publishedTime,
    dateModified: new Date().toISOString(),
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": opts.url,
    },
    about: {
      "@type": "Product",
      name: opts.product.name,
      description: opts.product.description,
    },
    mentions: [
      { "@type": "Organization", name: "SmartDent" },
      { "@type": "Thing", name: opts.product.category },
      ...(opts.product.brand ? [{ "@type": "Brand", name: opts.product.brand }] : []),
    ],
    author: buildPersonSchema(author),
    publisher: { "@id": "https://smartdent.com.br/#organization" },
    ...(opts.imageUrl
      ? {
          image: {
            "@type": "ImageObject",
            url: opts.imageUrl,
            width: 1200,
            height: 630,
          },
        }
      : {}),
  };
}

// ─── Main Handler ──────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body: SpinLandingPageRequest = await req.json();

    if (!body.spinData) throw new Error("spinData is required");
    if (!body.product) throw new Error("product is required");

    const locale = body.locale ?? "pt-BR";
    const authorKey = body.authorKey ?? "default";
    const dryRun = body.dryRun ?? false;
    const saveToDb = body.saveToDb !== false && !dryRun;
    const now = new Date().toISOString();
    const { spinData, product } = body;

    console.log(
      `[generate-spin-landing-page] Generating SPIN LP for: ${product.name} (${locale})`
    );

    // ── Generate SPIN LP with AI ──
    const aiResult = await generateSpinLPWithAI(spinData, product, locale);

    const localePrefix = locale === "pt-BR" ? "pt" : locale === "en-US" ? "en" : "es";
    const canonicalUrl = `${BASE_URL}/${localePrefix}/landing/${product.slug}`;

    // ── Build JSON-LD schemas ──
    const webPageSchema = buildWebPageSchema({
      title: aiResult.meta.title,
      description: aiResult.meta.description,
      url: canonicalUrl,
      imageUrl: product.imageUrl,
      locale,
      product,
      spin: spinData,
      authorKey,
      publishedTime: now,
    });

    const productSchema = buildProductSchema(product, locale);
    const faqSchema = buildFAQPageSchema(aiResult.faqs ?? []);
    const howToSchema = buildHowToSchema(product);

    const allSchemas = [
      webPageSchema,
      productSchema,
      faqSchema,
      ...(howToSchema ? [howToSchema] : []),
      ...aiResult.jsonLd,
    ];

    // ── Build hreflang ──
    const hreflangUrls = buildDefaultHreflangEntries(BASE_URL, `landing/${product.slug}`);

    // ── Build breadcrumbs ──
    const breadcrumbs = [
      { name: "Início", url: `${BASE_URL}` },
      { name: "Soluções", url: `${BASE_URL}/solucoes` },
      { name: product.category, url: `${BASE_URL}/solucoes/${product.category.toLowerCase().replace(/\s+/g, "-")}` },
      { name: product.name, url: canonicalUrl },
    ];

    // ── Call template-engine ──
    const templateReq = {
      type: "spin-landing-page",
      articleHtml: aiResult.articleHtml,
      jsonLd: allSchemas,
      meta: {
        title: aiResult.meta.title,
        description: aiResult.meta.description,
        keywords: aiResult.meta.keywords,
        ogTitle: aiResult.meta.ogTitle,
        ogDescription: aiResult.meta.ogDescription,
        ogImage: product.imageUrl,
        canonicalUrl,
        locale,
        articlePublishedTime: now,
        articleModifiedTime: now,
        articleAuthor: (SMARTDENT_AUTHORS[authorKey] ?? SMARTDENT_AUTHORS.default).name,
        articleSection: product.category,
      },
      options: {
        hreflangUrls,
        breadcrumbs,
        geoContextKeywords: [
          ...aiResult.meta.keywords,
          "SPIN selling odontológico",
          product.name,
        ],
        includeLocalBusiness: true,
        includeSpeakable: true,
        lcpImageSrc: product.imageUrl,
        robots: "index, follow, max-snippet:-1, max-image-preview:large",
      },
    };

    const { data: templateResult, error: templateError } = await supabase.functions.invoke(
      "template-engine",
      { body: templateReq }
    );

    if (templateError) throw new Error(`Template engine error: ${templateError.message}`);
    if (!templateResult?.success)
      throw new Error(`Template engine failed: ${JSON.stringify(templateResult)}`);

    const fullHtml = templateResult.html as string;
    const stats = templateResult.stats;

    console.log(
      `[generate-spin-landing-page] Score: ${stats?.score}/10, Size: ${stats?.htmlSizeKb}KB, Warnings: ${stats?.warnings?.length ?? 0}`
    );

    // ── Save to database ──
    let savedId: string | null = null;

    if (saveToDb) {
      const slug = `spin-lp-${product.slug}-${locale.toLowerCase().replace("-", "")}`;
      const { data: inserted, error: insertError } = await supabase
        .from("knowledge_contents")
        .upsert(
          {
            title: aiResult.meta.title,
            slug,
            excerpt: aiResult.meta.description,
            content_html: fullHtml,
            faqs: aiResult.faqs,
            keywords: aiResult.meta.keywords,
            meta_description: aiResult.meta.description,
            ai_context: `SPIN Landing Page: ${product.name}. ${spinData.needPayoff}`,
            active: true,
            category_id: body.categoryId ?? null,
            updated_at: now,
          },
          { onConflict: "slug" }
        )
        .select("id")
        .single();

      if (insertError) {
        console.error("[generate-spin-landing-page] DB save error:", insertError);
      } else {
        savedId = inserted?.id ?? null;
        console.log(`[generate-spin-landing-page] Saved to DB: ${savedId}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        product: product.name,
        locale,
        dryRun,
        savedId,
        canonicalUrl,
        stats,
        html: dryRun ? fullHtml : undefined,
        meta: aiResult.meta,
        faqs: aiResult.faqs,
        spinStructure: {
          situation: spinData.situation.substring(0, 100) + "...",
          problemCount: spinData.problem.length,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[generate-spin-landing-page] Error:", error);
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
