// ═══════════════════════════════════════════════════════════════════════════
// GENERATE PRODUCT BLOG
// Generates a complete, SEO/GEO/E-E-A-T/AI-Ready HTML blog article for a
// SmartDent product using the AI gateway + template-engine.
//
// Input: POST {
//   productId?,         — optional: fetch product from catalog
//   productData?,       — or supply directly
//   authorKey?,         — key from SMARTDENT_AUTHORS (default: "default")
//   locale?,            — "pt-BR" | "en-US" | "es-ES"  (default: "pt-BR")
//   saveToDb?,          — save result to knowledge_contents (default: true)
//   dryRun?             — return HTML without saving (default: false)
// }
// ═══════════════════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";
import { logAIUsage, extractUsage } from "../_shared/log-ai-usage.ts";
import { MASTER_SYSTEM_PROMPT, BLOG_PROMPT_EXTENSION } from "../_shared/master-system-prompt.ts";
import {
  SMARTDENT_AUTHORS,
  SMARTDENT_COMPANY,
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
}

interface BlogRequest {
  productId?: string;
  productData?: ProductData;
  authorKey?: string;
  locale?: "pt-BR" | "en-US" | "es-ES";
  saveToDb?: boolean;
  dryRun?: boolean;
  categoryId?: string;
}

// ─── AI Generation ─────────────────────────────────────────────────────────────

async function generateBlogWithAI(
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

  const specsBlock =
    product.technicalSpecs && Object.keys(product.technicalSpecs).length > 0
      ? Object.entries(product.technicalSpecs)
          .map(([k, v]) => `- ${k}: ${v}`)
          .join("\n")
      : "";

  const featuresBlock = product.features?.length
    ? product.features.map((f) => `- ${f}`).join("\n")
    : "";

  const certsBlock = product.certifications?.length
    ? product.certifications.map((c) => `- ${c}`).join("\n")
    : "";

  const userPrompt = `Gere um artigo de blog completo em ${localeLabel} para o seguinte produto:

PRODUTO: ${product.name}
CATEGORIA: ${product.category}
${product.brand ? `MARCA: ${product.brand}` : ""}
${product.sku ? `SKU: ${product.sku}` : ""}
DESCRIÇÃO: ${product.description}

${featuresBlock ? `CARACTERÍSTICAS:\n${featuresBlock}` : ""}
${specsBlock ? `ESPECIFICAÇÕES TÉCNICAS:\n${specsBlock}` : ""}
${certsBlock ? `CERTIFICAÇÕES:\n${certsBlock}` : ""}
${product.ratingValue ? `AVALIAÇÃO: ${product.ratingValue}/5 (${product.reviewCount} avaliações)` : ""}

RETORNE obrigatoriamente um JSON com o formato especificado no system prompt.
Inclua no articleHtml:
1. <article> semântico com id="article-${product.slug}"
2. Resumo speakable em #article-summary (2-3 frases respondendo: "O que é ${product.name}?")
3. H1 com nome do produto e palavra-chave principal
4. Mínimo 3 seções H2 com content-card
5. Tabela de especificações técnicas (se specs disponíveis)
6. Grid de benefícios (grid-benefits com 3+ benefit-cards)
7. Seção FAQ com mínimo 5 pares pergunta/resposta
8. CTA final para ${product.productUrl ?? BASE_URL + "/produtos/" + product.slug}

No jsonLd inclua: Article, Product (com Offer${product.ratingValue ? " e AggregateRating" : ""}).
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
        { role: "system", content: MASTER_SYSTEM_PROMPT + "\n\n" + BLOG_PROMPT_EXTENSION },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.4,
      max_tokens: 12000,
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
    functionName: "generate-product-blog",
    actionLabel: "generate-blog-article",
    model: "google/gemini-2.5-flash",
    promptTokens: usage.prompt_tokens,
    completionTokens: usage.completion_tokens,
  });

  const raw = aiData.choices?.[0]?.message?.content ?? "";

  // Strip markdown code fences if present
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
    manufacturer: {
      "@id": "https://smartdent.com.br/#organization",
    },
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
      availability: product.inStock !== false
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

  if (product.certifications?.length) {
    schema.hasCertification = product.certifications.map((cert) => ({
      "@type": "Certification",
      name: cert,
    }));
  }

  return schema;
}

function buildArticleSchema(opts: {
  title: string;
  description: string;
  url: string;
  imageUrl?: string;
  authorKey: string;
  publishedTime: string;
  product: ProductData;
  locale: string;
}) {
  const author = SMARTDENT_AUTHORS[opts.authorKey] ?? SMARTDENT_AUTHORS.default;
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: truncateTitle(opts.title),
    description: truncateMetaDescription(opts.description),
    url: opts.url,
    datePublished: opts.publishedTime,
    dateModified: new Date().toISOString(),
    inLanguage: opts.locale,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": opts.url,
    },
    author: buildPersonSchema(author),
    publisher: {
      "@id": "https://smartdent.com.br/#organization",
    },
    about: {
      "@type": "Product",
      name: opts.product.name,
      description: opts.product.description,
    },
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

// ─── Main Handler ──────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body: BlogRequest = await req.json();

    const locale = body.locale ?? "pt-BR";
    const authorKey = body.authorKey ?? "default";
    const dryRun = body.dryRun ?? false;
    const saveToDb = body.saveToDb !== false && !dryRun;
    const now = new Date().toISOString();

    // ── Resolve product data ──
    let product: ProductData;

    if (body.productData) {
      product = body.productData;
    } else if (body.productId) {
      const { data, error } = await supabase
        .from("catalog_products")
        .select("*")
        .eq("id", body.productId)
        .single();
      if (error || !data) throw new Error(`Product not found: ${body.productId}`);

      product = {
        name: data.name,
        slug: data.slug,
        description: data.description ?? "",
        category: data.category ?? "Odontologia Digital",
        brand: data.brand,
        sku: data.sku,
        price: data.price,
        imageUrl: data.image_url,
        features: data.features ?? [],
        technicalSpecs: data.technical_specs ?? {},
        certifications: data.certifications ?? [],
        ratingValue: data.rating_value,
        reviewCount: data.review_count,
        inStock: data.in_stock,
        productUrl: `${BASE_URL}/produtos/${data.slug}`,
      };
    } else {
      throw new Error("Either productId or productData is required");
    }

    console.log(`[generate-product-blog] Generating blog for: ${product.name} (${locale})`);

    // ── Generate article content with AI ──
    const aiResult = await generateBlogWithAI(product, locale);

    const canonicalUrl = `${BASE_URL}/${locale === "pt-BR" ? "pt" : locale === "en-US" ? "en" : "es"}/blog/${product.slug}`;

    // ── Build JSON-LD schemas ──
    const articleSchema = buildArticleSchema({
      title: aiResult.meta.title,
      description: aiResult.meta.description,
      url: canonicalUrl,
      imageUrl: product.imageUrl,
      authorKey,
      publishedTime: now,
      product,
      locale,
    });

    const productSchema = buildProductSchema(product, locale);
    const faqSchema = buildFAQPageSchema(aiResult.faqs ?? []);

    const allSchemas = [articleSchema, productSchema, faqSchema, ...aiResult.jsonLd];

    // ── Build hreflang ──
    const hreflangUrls = buildDefaultHreflangEntries(BASE_URL, `blog/${product.slug}`);

    // ── Build breadcrumbs ──
    const breadcrumbs = [
      { name: "Início", url: `${BASE_URL}` },
      { name: "Blog", url: `${BASE_URL}/blog` },
      { name: product.category, url: `${BASE_URL}/blog/${product.category.toLowerCase().replace(/\s+/g, "-")}` },
      { name: product.name, url: canonicalUrl },
    ];

    // ── Call template-engine ──
    const templateReq = {
      type: "product-blog",
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
        geoContextKeywords: aiResult.meta.keywords,
        includeLocalBusiness: true,
        includeSpeakable: true,
        lcpImageSrc: product.imageUrl,
      },
    };

    const { data: templateResult, error: templateError } = await supabase.functions.invoke(
      "template-engine",
      { body: templateReq }
    );

    if (templateError) throw new Error(`Template engine error: ${templateError.message}`);
    if (!templateResult?.success) throw new Error(`Template engine failed: ${JSON.stringify(templateResult)}`);

    const fullHtml = templateResult.html as string;
    const stats = templateResult.stats;

    console.log(
      `[generate-product-blog] Score: ${stats?.score}/10, Size: ${stats?.htmlSizeKb}KB, Warnings: ${stats?.warnings?.length ?? 0}`
    );

    // ── Save to database ──
    let savedId: string | null = null;

    if (saveToDb) {
      const slug = `blog-${product.slug}-${locale.toLowerCase().replace("-", "")}`;
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
            ai_context: `Product blog: ${product.name}. ${aiResult.meta.description}`,
            active: true,
            category_id: body.categoryId ?? null,
            updated_at: now,
          },
          { onConflict: "slug" }
        )
        .select("id")
        .single();

      if (insertError) {
        console.error("[generate-product-blog] DB save error:", insertError);
      } else {
        savedId = inserted?.id ?? null;
        console.log(`[generate-product-blog] Saved to DB: ${savedId}`);
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
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[generate-product-blog] Error:", error);
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
