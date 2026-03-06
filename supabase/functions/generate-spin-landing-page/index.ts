// ═══════════════════════════════════════════════════════════
// GENERATE SPIN LANDING PAGE — Landing Page SPIN Selling
// Gera LP com 9 seções semânticas: Situação, Problema,
// Implicação, Necessidade/Payoff + prova social, HowTo,
// FAQ — com SEO, GEO, E-E-A-T e AI-Readiness completos.
// ═══════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { logAIUsage, extractUsage } from "../_shared/log-ai-usage.ts";
import { MASTER_SEO_GEO_EEAT_PROMPT } from "../_shared/master-system-prompt.ts";
import {
  buildDefaultHreflangEntries,
  buildImageTag,
  slugify,
} from "../_shared/seo-fine-tuning.ts";
import {
  SMARTDENT_COMPANY,
  getAuthorSchema,
  buildAggregateRating,
} from "../_shared/authority-data-helper.ts";
import {
  buildDocument,
  buildBreadcrumbList,
  buildFAQSchema,
  buildHowToSchema,
  buildOrganizationNode,
  buildPersonNode,
} from "../template-engine/index.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SITE_BASE_URL = Deno.env.get("SITE_BASE_URL") ?? "https://smartdent.com.br";

// ───────────────────────────────────────────────────────────
// TYPES
// ───────────────────────────────────────────────────────────

interface SPINSection {
  headline: string;
  body: string;
}

interface SPINLPRequest {
  productName: string;
  productDescription: string;
  category: string;
  targetKeyword: string;
  targetAudience: string;
  /** Optional hero image */
  heroImageUrl?: string;
  heroImageAlt?: string;
  /** Author ID */
  authorId?: string;
  /** Optional product purchase/demo URL */
  ctaUrl?: string;
  ctaLabel?: string;
  /** Optional Supabase category for persistence */
  categoryId?: string;
  /** Dry run — do not persist */
  dryRun?: boolean;
  /** Rating data (real only) */
  rating?: { value: number; count: number };
}

interface SPINLPContent {
  title: string;
  metaDescription: string;
  situation: SPINSection;
  problem: SPINSection;
  implication: SPINSection;
  payoff: SPINSection;
  productDeep: SPINSection;
  testimonial: SPINSection;
  howToSteps: { name: string; text: string }[];
  faqs: { question: string; answer: string }[];
  cta: SPINSection;
  aiContext: string;
}

// ───────────────────────────────────────────────────────────
// AI CONTENT GENERATION
// ───────────────────────────────────────────────────────────

async function generateSPINContent(req: SPINLPRequest): Promise<SPINLPContent> {
  if (!LOVABLE_API_KEY) {
    throw new Error("LOVABLE_API_KEY não configurada");
  }

  const userPrompt = `Gere uma Landing Page SPIN Selling completa para o produto abaixo.

PRODUTO: ${req.productName}
DESCRIÇÃO: ${req.productDescription}
CATEGORIA: ${req.category}
KEYWORD ALVO: ${req.targetKeyword}
PÚBLICO-ALVO: ${req.targetAudience}

ENTREGUE UM JSON com exatamente este formato:
{
  "title": "Título da LP (máx 60 chars, inclui keyword, orientado à conversão)",
  "metaDescription": "Meta description (máx 160 chars, inclui keyword + benefício)",
  "situation": {
    "headline": "Headline da seção Situação (H2)",
    "body": "HTML da seção — descreve a situação atual do público-alvo (1-2 parágrafos)"
  },
  "problem": {
    "headline": "Headline da seção Problema (H2)",
    "body": "HTML da seção — aponta a dor/problema que o produto resolve"
  },
  "implication": {
    "headline": "Headline da seção Implicação (H2)",
    "body": "HTML da seção — consequências de não resolver o problema"
  },
  "payoff": {
    "headline": "Headline da seção Payoff (H2)",
    "body": "HTML da seção — como o produto resolve o problema, benefícios reais"
  },
  "productDeep": {
    "headline": "Headline da seção Produto em Profundidade (H2)",
    "body": "HTML da seção — especificações técnicas, diferenciais, como funciona"
  },
  "testimonial": {
    "headline": "Headline da seção Prova Social (H2)",
    "body": "HTML com <blockquote> representando um depoimento típico de cliente (não inventar nomes reais)"
  },
  "howToSteps": [
    { "name": "Passo 1", "text": "Descrição do passo 1" },
    { "name": "Passo 2", "text": "Descrição do passo 2" },
    { "name": "Passo 3", "text": "Descrição do passo 3" }
  ],
  "faqs": [
    { "question": "Pergunta 1?", "answer": "Resposta 1." },
    { "question": "Pergunta 2?", "answer": "Resposta 2." }
  ],
  "cta": {
    "headline": "Headline do CTA final (H2)",
    "body": "Texto do CTA com proposta de valor clara"
  },
  "aiContext": "Paragraph in English describing this product for AI crawlers"
}

REGRAS:
- Cada body é HTML semântico puro (sem <html>/<head>/<body>)
- Tom consultivo, não sensacionalista
- Baseado APENAS nos dados do produto fornecidos
- howToSteps: 3 a 6 passos de como usar/implementar o produto
- faqs: 5 a 8 perguntas relevantes sobre o produto
- testimonial: use <blockquote> com aspas. Não invente nomes de pessoas reais.`;

  const response = await fetch(
    "https://ai.gateway.lovable.dev/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: MASTER_SEO_GEO_EEAT_PROMPT },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.6,
        max_tokens: 10000,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`AI API error ${response.status}`);
  }

  const data = await response.json();
  const usage = extractUsage(data);
  await logAIUsage({
    functionName: "generate-spin-landing-page",
    actionLabel: "generate-spin-content",
    model: "google/gemini-2.5-flash",
    promptTokens: usage.prompt_tokens,
    completionTokens: usage.completion_tokens,
  });

  const content = data.choices?.[0]?.message?.content ?? "";
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("AI response did not contain valid JSON");

  return JSON.parse(jsonMatch[0]);
}

// ───────────────────────────────────────────────────────────
// JSON-LD GRAPH BUILDER
// ───────────────────────────────────────────────────────────

function buildSPINJsonLdGraph(
  req: SPINLPRequest,
  content: SPINLPContent,
  canonicalUrl: string,
  publishedDate: string
): Record<string, unknown>[] {
  const author = getAuthorSchema(req.authorId);
  const slug = slugify(req.productName);

  const speakable = {
    "@type": "SpeakableSpecification",
    cssSelector: ["h1", ".lp-situation", ".lp-payoff", ".geo-context"],
  };

  const webPageNode: Record<string, unknown> = {
    "@type": "WebPage",
    "@id": canonicalUrl,
    name: content.title,
    description: content.metaDescription,
    url: canonicalUrl,
    inLanguage: "pt-BR",
    datePublished: publishedDate,
    dateModified: publishedDate,
    author: { "@id": author["@id"] },
    publisher: { "@id": SMARTDENT_COMPANY["@id"] },
    mainEntity: { "@id": `${canonicalUrl}#product` },
    speakable,
    about: {
      "@type": "Thing",
      name: req.productName,
      description: req.productDescription,
    },
    mentions: [
      { "@type": "Thing", name: req.category },
      { "@type": "Organization", name: "SmartDent" },
      { "@type": "Audience", audienceType: req.targetAudience },
    ],
  };

  const productNode: Record<string, unknown> = {
    "@type": "Product",
    "@id": `${canonicalUrl}#product`,
    name: req.productName,
    description: req.productDescription,
    category: req.category,
    brand: { "@type": "Brand", name: "SmartDent" },
    ...(req.heroImageUrl ? { image: req.heroImageUrl } : {}),
    ...(req.ctaUrl
      ? {
          offers: {
            "@type": "Offer",
            availability: "https://schema.org/InStock",
            seller: { "@id": SMARTDENT_COMPANY["@id"] },
            priceCurrency: "BRL",
            url: req.ctaUrl,
          },
        }
      : {}),
    ...(req.rating
      ? { aggregateRating: buildAggregateRating(req.rating.value, req.rating.count) }
      : {}),
  };

  const howToNode = buildHowToSchema(
    `Como usar ${req.productName}`,
    `Guia passo a passo para implementar ${req.productName} no seu consultório ou laboratório dental.`,
    content.howToSteps
  );

  const breadcrumb = buildBreadcrumbList([
    { name: "SmartDent", url: SITE_BASE_URL },
    { name: "Produtos", url: `${SITE_BASE_URL}/produtos` },
    { name: req.category, url: `${SITE_BASE_URL}/produtos/${slugify(req.category)}` },
    { name: req.productName, url: canonicalUrl },
  ]);

  const faqNode = content.faqs.length > 0 ? buildFAQSchema(content.faqs) : null;

  const graph: Record<string, unknown>[] = [
    webPageNode,
    productNode,
    howToNode,
    breadcrumb,
    buildPersonNode(author),
    buildOrganizationNode(SMARTDENT_COMPANY as unknown as Parameters<typeof buildOrganizationNode>[0]),
  ];

  if (faqNode) graph.push(faqNode);

  return graph;
}

// ───────────────────────────────────────────────────────────
// HTML BODY ASSEMBLER — 9 Semantic Sections
// ───────────────────────────────────────────────────────────

function assembleSpinBody(req: SPINLPRequest, content: SPINLPContent): string {
  const ctaUrl = req.ctaUrl ?? `${SITE_BASE_URL}/contato`;
  const ctaLabel = req.ctaLabel ?? "Solicitar Demonstração";

  const heroImg = req.heroImageUrl
    ? buildImageTag({
        src: req.heroImageUrl,
        alt: req.heroImageAlt ?? req.productName,
        width: 1200,
        height: 630,
        isLCP: true,
        cssClass: "hero-image",
      })
    : "";

  const faqHtml =
    content.faqs.length > 0
      ? `
<section class="lp-faq" aria-label="Perguntas Frequentes">
  <h2>Perguntas Frequentes sobre ${req.productName}</h2>
  ${content.faqs
    .map(
      (faq) => `
  <div class="faq-item">
    <h3>${faq.question}</h3>
    <p>${faq.answer}</p>
  </div>`
    )
    .join("")}
</section>`
      : "";

  const howToHtml = `
<section class="lp-howto" aria-label="Como usar ${req.productName}">
  <h2>Como implementar ${req.productName} no seu fluxo</h2>
  <ol class="howto-steps">
    ${content.howToSteps
      .map(
        (step, i) => `
    <li class="howto-step">
      <strong>${i + 1}. ${step.name}</strong>
      <p>${step.text}</p>
    </li>`
      )
      .join("")}
  </ol>
</section>`;

  return `
<main>
  <article itemscope itemtype="https://schema.org/WebPage">

    <!-- 1. HERO -->
    <header class="lp-hero">
      <h1 itemprop="name">${content.title}</h1>
      ${heroImg}
    </header>

    <!-- 2. SITUAÇÃO -->
    <section class="lp-situation content-card">
      <h2>${content.situation.headline}</h2>
      ${content.situation.body}
    </section>

    <!-- 3. PROBLEMA -->
    <section class="lp-problem content-card">
      <h2>${content.problem.headline}</h2>
      ${content.problem.body}
    </section>

    <!-- 4. IMPLICAÇÃO -->
    <section class="lp-implication content-card">
      <h2>${content.implication.headline}</h2>
      ${content.implication.body}
    </section>

    <!-- 5. PAYOFF -->
    <section class="lp-payoff content-card">
      <h2>${content.payoff.headline}</h2>
      ${content.payoff.body}
    </section>

    <!-- 6. PRODUTO EM PROFUNDIDADE -->
    <section class="lp-product-deep content-card">
      <h2>${content.productDeep.headline}</h2>
      ${content.productDeep.body}
    </section>

    <!-- 7. PROVA SOCIAL -->
    <section class="lp-testimonial content-card">
      <h2>${content.testimonial.headline}</h2>
      ${content.testimonial.body}
    </section>

    <!-- 8. HOW TO -->
    ${howToHtml}

    <!-- 9. FAQ -->
    ${faqHtml}

    <!-- 10. CTA FINAL -->
    <section class="lp-cta cta-panel">
      <h2>${content.cta.headline}</h2>
      ${content.cta.body}
      <a href="${ctaUrl}" class="btn btn-primary" rel="noopener">${ctaLabel}</a>
    </section>

    <footer class="lp-footer">
      <p>SmartDent — especialistas em odontologia digital.
        <a href="${SITE_BASE_URL}">smartdent.com.br</a>
      </p>
    </footer>

  </article>
</main>

<nav aria-label="Breadcrumb" class="breadcrumb">
  <ol>
    <li><a href="${SITE_BASE_URL}">SmartDent</a></li>
    <li><a href="${SITE_BASE_URL}/produtos">Produtos</a></li>
    <li aria-current="page">${req.productName}</li>
  </ol>
</nav>`;
}

// ───────────────────────────────────────────────────────────
// HTTP HANDLER
// ───────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: SPINLPRequest = await req.json();

    if (
      !body.productName ||
      !body.productDescription ||
      !body.category ||
      !body.targetKeyword ||
      !body.targetAudience
    ) {
      return new Response(
        JSON.stringify({
          success: false,
          error:
            "Campos obrigatórios: productName, productDescription, category, targetKeyword, targetAudience",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[generate-spin-landing-page] Generating LP for: ${body.productName}`);

    // 1. Generate AI content
    const content = await generateSPINContent(body);

    // 2. Build URLs
    const slug = `lp-${slugify(body.productName)}`;
    const canonicalUrl = `${SITE_BASE_URL}/landing/${slug}`;
    const publishedDate = new Date().toISOString();

    // 3. Hreflang
    const hreflangEntries = buildDefaultHreflangEntries(
      canonicalUrl,
      "/landing",
      slug,
      SITE_BASE_URL
    );

    // 4. SEO options
    const seoOpts = {
      title: content.title,
      metaDescription: content.metaDescription,
      canonicalUrl,
      hreflangEntries,
      ogTitle: content.title,
      ogDescription: content.metaDescription,
      ogImage: body.heroImageUrl,
      ogType: "website" as const,
      robots: "index, follow",
    };

    // 5. JSON-LD graph
    const jsonLdGraph = buildSPINJsonLdGraph(body, content, canonicalUrl, publishedDate);

    // 6. Body HTML
    const bodyHtml = assembleSpinBody(body, content);

    // 7. Build full document
    const { html, stats } = buildDocument({
      seo: seoOpts,
      geoContext: {
        productName: body.productName,
        category: body.category,
        manufacturer: "SmartDent",
        targetKeyword: body.targetKeyword,
        locale: "pt-BR",
        country: "BR",
        region: "São Paulo, SP",
      },
      jsonLdGraphNodes: jsonLdGraph,
      bodyHtml,
    });

    console.log(
      `[generate-spin-landing-page] Score: ${stats.score}/10 — ${stats.byteSize} bytes`
    );
    if (stats.warnings.length > 0) {
      console.warn(`[generate-spin-landing-page] Warnings:`, stats.warnings);
    }

    // 8. Persist
    let savedId: string | null = null;
    if (!body.dryRun && body.categoryId) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      const { data: saved, error: saveError } = await supabase
        .from("knowledge_contents")
        .upsert(
          {
            category_id: body.categoryId,
            title: content.title,
            slug,
            excerpt: content.metaDescription,
            content_html: html,
            faqs: content.faqs,
            keywords: [body.targetKeyword, body.productName, body.category, body.targetAudience],
            meta_description: content.metaDescription,
            ai_context: content.aiContext,
            active: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "slug" }
        )
        .select("id")
        .single();

      if (saveError) {
        console.error("[generate-spin-landing-page] DB save error:", saveError);
      } else {
        savedId = saved?.id ?? null;
        console.log(`[generate-spin-landing-page] Saved with id: ${savedId}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        slug,
        canonicalUrl,
        savedId,
        stats,
        html: body.dryRun ? html : undefined,
        title: content.title,
        metaDescription: content.metaDescription,
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
