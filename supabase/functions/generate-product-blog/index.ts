// ═══════════════════════════════════════════════════════════
// GENERATE PRODUCT BLOG — Gerador de Blog de Produto
// Gera artigo HTML completo com SEO Técnico, GEO,
// E-E-A-T, AI-Readiness e Core Web Vitals.
// ═══════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { logAIUsage, extractUsage } from "../_shared/log-ai-usage.ts";
import { MASTER_SEO_GEO_EEAT_PROMPT } from "../_shared/master-system-prompt.ts";
import {
  buildSeoHead,
  buildDefaultHreflangEntries,
  buildGeoContextBlock,
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

interface BlogGenerationRequest {
  productName: string;
  productDescription: string;
  category: string;
  targetKeyword: string;
  /** Optional product URL for Schema Product */
  productUrl?: string;
  /** Optional hero image URL */
  heroImageUrl?: string;
  /** Optional hero image alt text */
  heroImageAlt?: string;
  /** Author ID from SMARTDENT_AUTHORS */
  authorId?: string;
  /** If provided, upsert to knowledge_contents table */
  categoryId?: string;
  /** Dry run — generate but do not persist */
  dryRun?: boolean;
  /** Optional rating data (real data only) */
  rating?: { value: number; count: number };
}

// ───────────────────────────────────────────────────────────
// AI CONTENT GENERATION
// ───────────────────────────────────────────────────────────

async function generateBlogContent(req: BlogGenerationRequest): Promise<{
  title: string;
  metaDescription: string;
  bodyHtml: string;
  faqs: { question: string; answer: string }[];
  aiContext: string;
}> {
  if (!LOVABLE_API_KEY) {
    throw new Error("LOVABLE_API_KEY não configurada");
  }

  const userPrompt = `Gere um artigo de blog completo e otimizado para SEO sobre o produto abaixo.

PRODUTO: ${req.productName}
DESCRIÇÃO: ${req.productDescription}
CATEGORIA: ${req.category}
KEYWORD ALVO: ${req.targetKeyword}

ENTREGUE UM JSON com exatamente este formato:
{
  "title": "Título do artigo (máx. 60 chars, inclui keyword)",
  "metaDescription": "Meta description (máx. 160 chars, inclui keyword)",
  "bodyHtml": "HTML semântico do corpo do artigo (sem <html>/<head>/<body>)",
  "faqs": [
    { "question": "Pergunta 1?", "answer": "Resposta detalhada 1." },
    { "question": "Pergunta 2?", "answer": "Resposta detalhada 2." }
  ],
  "aiContext": "Parágrafo em inglês descrevendo o produto para crawlers de IA"
}

REGRAS PARA O bodyHtml:
- Use HTML5 semântico: <article>, <section>, <header>, <footer>
- 1 H1 exato (título principal)
- H2 para seções principais, H3 dentro de seções
- Inclua class="article-summary" no primeiro parágrafo de resumo
- Mínimo 6 seções <section> com conteúdo substantivo
- Inclua seção de benefícios com <ul>/<li>
- Inclua seção técnica com especificações
- NO MÍNIMO 800 palavras de conteúdo
- NÃO inclua imagens no HTML (serão injetadas depois)
- NÃO adicione dados não presentes na descrição fornecida

REGRAS PARA faqs:
- 5 a 8 perguntas/respostas sobre o produto
- Perguntas naturais que um dentista faria
- Respostas entre 50-150 palavras cada`;

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
        max_tokens: 8000,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`AI API error ${response.status}`);
  }

  const data = await response.json();
  const usage = extractUsage(data);
  await logAIUsage({
    functionName: "generate-product-blog",
    actionLabel: "generate-blog-content",
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

function buildJsonLdGraph(
  req: BlogGenerationRequest,
  canonicalUrl: string,
  title: string,
  metaDescription: string,
  faqs: { question: string; answer: string }[],
  publishedDate: string
): Record<string, unknown>[] {
  const author = getAuthorSchema(req.authorId);
  const slug = slugify(req.productName);

  const speakable = {
    "@type": "SpeakableSpecification",
    cssSelector: ["h1", ".article-summary", ".geo-context"],
  };

  const articleNode: Record<string, unknown> = {
    "@type": "BlogPosting",
    "@id": `${canonicalUrl}#article`,
    headline: title,
    description: metaDescription,
    url: canonicalUrl,
    datePublished: publishedDate,
    dateModified: publishedDate,
    inLanguage: "pt-BR",
    author: { "@id": author["@id"] },
    publisher: { "@id": SMARTDENT_COMPANY["@id"] },
    mainEntityOfPage: { "@type": "WebPage", "@id": canonicalUrl },
    speakable,
    about: {
      "@type": "Thing",
      name: req.productName,
      description: req.productDescription,
    },
    mentions: [
      { "@type": "Thing", name: req.category },
      { "@type": "Organization", name: "SmartDent" },
      { "@type": "Thing", name: "Odontologia Digital" },
    ],
    ...(req.heroImageUrl
      ? {
          image: {
            "@type": "ImageObject",
            url: req.heroImageUrl,
            description: req.heroImageAlt ?? req.productName,
          },
        }
      : {}),
  };

  const productNode: Record<string, unknown> = {
    "@type": "Product",
    "@id": `${canonicalUrl}#product`,
    name: req.productName,
    description: req.productDescription,
    category: req.category,
    brand: { "@type": "Brand", name: "SmartDent" },
    ...(req.productUrl ? { url: req.productUrl } : {}),
    ...(req.heroImageUrl ? { image: req.heroImageUrl } : {}),
    ...(req.rating
      ? { aggregateRating: buildAggregateRating(req.rating.value, req.rating.count) }
      : {}),
    offers: {
      "@type": "Offer",
      availability: "https://schema.org/InStock",
      seller: { "@id": SMARTDENT_COMPANY["@id"] },
      priceCurrency: "BRL",
      url: req.productUrl ?? canonicalUrl,
    },
  };

  const breadcrumb = buildBreadcrumbList([
    { name: "SmartDent", url: SITE_BASE_URL },
    { name: "Blog", url: `${SITE_BASE_URL}/blog` },
    { name: req.category, url: `${SITE_BASE_URL}/blog/${slugify(req.category)}` },
    { name: req.productName, url: canonicalUrl },
  ]);

  const faqNode = faqs.length > 0 ? buildFAQSchema(faqs) : null;

  const graph: Record<string, unknown>[] = [
    articleNode,
    productNode,
    breadcrumb,
    buildPersonNode(author),
    buildOrganizationNode(SMARTDENT_COMPANY as unknown as Parameters<typeof buildOrganizationNode>[0]),
  ];

  if (faqNode) graph.push(faqNode);

  return graph;
}

// ───────────────────────────────────────────────────────────
// FULL HTML BUILDER
// ───────────────────────────────────────────────────────────

function buildFaqHtml(faqs: { question: string; answer: string }[]): string {
  if (faqs.length === 0) return "";
  const items = faqs
    .map(
      (faq) => `
    <div class="faq-item">
      <h3>${faq.question}</h3>
      <p>${faq.answer}</p>
    </div>`
    )
    .join("");

  return `
<section class="faq-section" aria-label="Perguntas Frequentes">
  <h2>Perguntas Frequentes sobre ${""}</h2>
  ${items}
</section>`;
}

function assembleBodyHtml(
  req: BlogGenerationRequest,
  bodyHtml: string,
  faqs: { question: string; answer: string }[]
): string {
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

  return `
<main>
  <article itemscope itemtype="https://schema.org/BlogPosting">
    <header class="article-header">
      ${heroImg}
    </header>
    ${bodyHtml}
    ${buildFaqHtml(faqs)}
    <footer class="article-footer">
      <p>Publicado por <strong>SmartDent</strong> — especialistas em odontologia digital.</p>
    </footer>
  </article>
</main>
<nav aria-label="Breadcrumb" class="breadcrumb">
  <ol>
    <li><a href="${SITE_BASE_URL}">SmartDent</a></li>
    <li><a href="${SITE_BASE_URL}/blog">Blog</a></li>
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
    const body: BlogGenerationRequest = await req.json();

    if (!body.productName || !body.productDescription || !body.category || !body.targetKeyword) {
      return new Response(
        JSON.stringify({ success: false, error: "productName, productDescription, category e targetKeyword são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[generate-product-blog] Generating blog for: ${body.productName}`);

    // 1. Generate AI content
    const aiContent = await generateBlogContent(body);

    // 2. Build URLs
    const slug = slugify(body.productName);
    const canonicalUrl = `${SITE_BASE_URL}/blog/${slug}`;
    const publishedDate = new Date().toISOString();

    // 3. Build SEO head options
    const hreflangEntries = buildDefaultHreflangEntries(
      canonicalUrl,
      "/blog",
      slug,
      SITE_BASE_URL
    );

    const seoOpts = {
      title: aiContent.title,
      metaDescription: aiContent.metaDescription,
      canonicalUrl,
      hreflangEntries,
      ogTitle: aiContent.title,
      ogDescription: aiContent.metaDescription,
      ogImage: body.heroImageUrl,
      ogType: "article" as const,
    };

    // 4. Build JSON-LD graph
    const jsonLdGraph = buildJsonLdGraph(
      body,
      canonicalUrl,
      aiContent.title,
      aiContent.metaDescription,
      aiContent.faqs,
      publishedDate
    );

    // 5. Assemble body HTML
    const bodyHtml = assembleBodyHtml(body, aiContent.bodyHtml, aiContent.faqs);

    // 6. Build full document via template-engine
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

    console.log(`[generate-product-blog] Score: ${stats.score}/10 — ${stats.byteSize} bytes`);
    if (stats.warnings.length > 0) {
      console.warn(`[generate-product-blog] Warnings:`, stats.warnings);
    }

    // 7. Persist (unless dry run)
    let savedId: string | null = null;
    if (!body.dryRun && body.categoryId) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      const { data: saved, error: saveError } = await supabase
        .from("knowledge_contents")
        .upsert(
          {
            category_id: body.categoryId,
            title: aiContent.title,
            slug,
            excerpt: aiContent.metaDescription,
            content_html: html,
            faqs: aiContent.faqs,
            keywords: [body.targetKeyword, body.productName, body.category],
            meta_description: aiContent.metaDescription,
            ai_context: aiContent.aiContext,
            active: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "slug" }
        )
        .select("id")
        .single();

      if (saveError) {
        console.error("[generate-product-blog] DB save error:", saveError);
      } else {
        savedId = saved?.id ?? null;
        console.log(`[generate-product-blog] Saved with id: ${savedId}`);
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
        title: aiContent.title,
        metaDescription: aiContent.metaDescription,
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
