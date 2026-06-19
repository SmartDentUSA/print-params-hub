import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { aiComplete } from "../_shared/ai-router.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

const MAX_CAPTION = 2200;
const MAX_COMMENT = 500;
const MAX_HASHTAGS = 15;

interface ReqBody {
  product_name?: string;
  product_slug?: string;
  platform?: string;
  instructions?: string;
  tone?: string;
  language?: string;
  external_enrichment?: any;
  extra_products?: Array<{ name?: string; slug?: string; category?: string }>;
}

function sanitizeHashtags(arr: unknown): string[] {
  if (!Array.isArray(arr)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of arr) {
    const t = String(raw || "")
      .trim()
      .replace(/^#+/, "")
      .replace(/\s+/g, "")
      .toLowerCase();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= MAX_HASHTAGS) break;
  }
  return out;
}

async function fetchProductContext(name?: string, slug?: string) {
  const ctx: any[] = [];
  const pattern = name ? `%${name.replace(/[%_]/g, "")}%` : null;

  // 1) system_a_catalog (sem preço para o prompt)
  try {
    let q = supabase
      .from("system_a_catalog")
      .select("name, slug, category, description, canonical_url")
      .eq("active", true)
      .limit(3);
    if (slug) q = q.eq("slug", slug);
    else if (pattern) q = q.or(`name.ilike.${pattern},category.ilike.${pattern}`);
    const { data } = await q;
    for (const r of data || []) {
      ctx.push({
        source: "catalog",
        name: (r as any).name,
        category: (r as any).category,
        url: (r as any).canonical_url || ((r as any).slug ? `/produto/${(r as any).slug}` : null),
        text: String((r as any).description || "").slice(0, 600),
      });
    }
  } catch (e) {
    console.warn("[caption] catalog err", e);
  }

  // 2) resins
  try {
    let q = supabase
      .from("resins")
      .select("name, slug, manufacturer, type, description, ai_context")
      .eq("active", true)
      .limit(2);
    if (slug) q = q.eq("slug", slug);
    else if (pattern) q = q.or(`name.ilike.${pattern},manufacturer.ilike.${pattern},type.ilike.${pattern}`);
    const { data } = await q;
    for (const r of data || []) {
      ctx.push({
        source: "resin",
        name: (r as any).name,
        category: `Resina ${(r as any).type || ""}`.trim(),
        url: (r as any).slug ? `/base-conhecimento/d/${(r as any).slug}` : null,
        text: String((r as any).description || (r as any).ai_context || "").slice(0, 600),
      });
    }
  } catch (e) {
    console.warn("[caption] resins err", e);
  }

  // 3) products_catalog (datasheet summary)
  try {
    let q = supabase
      .from("products_catalog")
      .select("name, category, subcategory, datasheet_summary")
      .limit(2);
    if (pattern) q = q.or(`name.ilike.${pattern},category.ilike.${pattern}`);
    const { data } = await q;
    for (const r of data || []) {
      ctx.push({
        source: "datasheet",
        name: (r as any).name,
        category: (r as any).category,
        text: String((r as any).datasheet_summary || "").slice(0, 600),
      });
    }
  } catch (e) {
    console.warn("[caption] datasheet err", e);
  }

  return ctx;
}

async function fetchKnowledgeRag(query: string) {
  if (!query.trim()) return [];
  try {
    const { generateEmbedding } = await import("../_shared/generate-embedding.ts");
    const embedding = await generateEmbedding({ text: query, taskType: "RETRIEVAL_QUERY" });
    if (!embedding) return [];
    const { data } = await supabase.rpc("match_agent_embeddings", {
      query_embedding: embedding,
      match_threshold: 0.55,
      match_count: 5,
    });
    return (data || []).map((r: any) => ({
      source: r.source_type,
      title: r.metadata?.title || r.metadata?.name || "",
      text: String(r.chunk_text || "").slice(0, 400),
    }));
  } catch (e) {
    console.warn("[caption] rag err", e);
    return [];
  }
}

function platformGuidance(platform: string): string {
  switch ((platform || "").toLowerCase()) {
    case "instagram":
    case "facebook":
      return [
        "Plataforma: Instagram/Facebook.",
        "OBJETIVO: gerar SALVAMENTOS + COMENTÁRIOS e direcionar tráfego qualificado para WhatsApp/link da bio (consideração → conversão).",
        "TOM DE VOZ: especialista próximo, didático, confiante, levemente entusiasmado. Português BR coloquial-profissional. Sem clichê de coach, sem 'galera', sem caps lock gritado.",
        "FORMATO INSTAGRAM-RICH obrigatório:",
        "• 1ª linha = gancho forte com 1 emoji marcante (ex.: 🚀 ✨ 🦷 🔬 💡 ⚡ 🎯).",
        "• Linha em branco depois do gancho.",
        "• 3 a 6 bullets começando com '▸ ' OU '✔️ ', cada um com 1 emoji contextual.",
        "• Frase curta de transformação ou prova social.",
        "• CTA destacado em linha própria (ex.: '👉 Saiba mais no link da bio' ou '💬 Comenta AQUI que te envio').",
        "• Separador visual: linha exata '━━━━━━━━━━━━━━━'.",
        "• Depois do separador, linha em branco e o bloco de hashtags (todas juntas, prefixadas com #, separadas por espaço).",
        "• Use 6 a 12 emojis no TOTAL, contextuais (não decorativos genéricos).",
        "• Permitido (opcional, no MÁXIMO 2 ocorrências) destacar 1-2 palavras-chave com unicode estilizado tipo '𝗻𝗲𝗴𝗿𝗶𝘁𝗼' (Mathematical Sans-Serif Bold) ou '𝘪𝘵á𝘭𝘪𝘤𝘰' (Mathematical Sans-Serif Italic). NUNCA use markdown (**, __, ##) — Instagram renderiza literal.",
        "• NÃO use # nas hashtags do array JSON 'hashtags' (apenas a palavra). MAS dentro da caption pode colocar 1 hashtag-âncora opcional após o CTA.",
      ].join("\n");
    case "tiktok":
      return [
        "Plataforma: TikTok.",
        "OBJETIVO: maximizar retenção e comentários (sinal de algoritmo) para puxar tráfego ao perfil/WhatsApp.",
        "TOM DE VOZ: direto, jovem-profissional, ritmo de fala, frases curtas, leve provocação/curiosidade. Sem jargão técnico pesado.",
        "FORMATO: caption até 150 chars, gancho-bomba na 1ª frase ('Você ainda usa…?', 'Ninguém te conta que…'), 1-2 emojis MÁX, 3-5 hashtags de descoberta (ex.: odonto, fy, dentista, impressao3d). Sem bullets, sem separadores, sem markdown.",
      ].join("\n");
    case "youtube":
      return [
        "Plataforma: YouTube Shorts.",
        "OBJETIVO: ganhar inscritos e cliques no link da descrição; reforçar autoridade técnica de longo prazo (SEO de vídeo).",
        "TOM DE VOZ: educativo, claro, autoral. Mistura curiosidade ('Veja por que…') com prova ('testado em X casos').",
        "FORMATO: caption objetiva 2-4 linhas, 1ª linha = promessa de aprendizado, CTA explícito para inscrever-se ou ver vídeo completo. Hashtags 3-6 com keywords de busca (#impressao3d #odontologiadigital). Sem emojis excessivos.",
      ].join("\n");
    case "linkedin":
      return [
        "Plataforma: LinkedIn.",
        "OBJETIVO: construir autoridade B2B, gerar conversas com clínicas/laboratórios/distribuidores e leads qualificados via DM.",
        "TOM DE VOZ: consultivo-sênior, analítico, baseado em dados e cases. Primeira pessoa, sem hype, sem emojis decorativos (máx 1-2 funcionais).",
        "FORMATO: abertura provocativa em 1 linha (quebra de padrão ou estatística), linha em branco, 6-10 linhas com parágrafos curtos (1-2 frases), insight prático ou aprendizado, CTA reflexivo ('Como vocês resolvem isso na clínica?'). 3-5 hashtags técnicas no fim.",
      ].join("\n");
    case "pinterest":
      return [
        "Plataforma: Pinterest.",
        "OBJETIVO: SEO visual de longa duração — capturar buscas 'como fazer / qual melhor / passo a passo' e levar ao site.",
        "TOM DE VOZ: descritivo, informativo, neutro-profissional. Sem gírias, sem emojis.",
        "FORMATO: título 1ª linha (até 100 chars) com keyword principal, descrição rica 2-3 frases com sinônimos e termos de busca (resina 3D, impressora odontológica, protocolo digital), CTA suave ('Saiba mais'). 5-10 hashtags categóricas.",
      ].join("\n");
    case "reddit":
      return [
        "Plataforma: Reddit.",
        "OBJETIVO: gerar discussão genuína dentro do subreddit, NUNCA soar como anúncio (autopromoção é banida).",
        "TOM DE VOZ: par-a-par, humilde, técnico-honesto, primeira pessoa. Admite limitações. Zero marketing-speak, zero emojis, zero hashtags.",
        "FORMATO: título estilo pergunta ou observação ('Anyone else noticed…?'), corpo em parágrafos, contexto + dúvida/insight, sem links promocionais diretos no corpo.",
      ].join("\n");
    case "twitter":
      return [
        "Plataforma: X/Twitter.",
        "OBJETIVO: viralização por insight curto, ganhar follows e cliques no link.",
        "TOM DE VOZ: incisivo, opinativo, com personalidade. Frases curtas, quebra de linha entre ideias. Pode ter 1 emoji âncora.",
        "FORMATO: tweet único até 270 chars OU thread (1ª linha = hook absoluto). 1-3 hashtags MÁX no fim. Sem markdown.",
      ].join("\n");
    case "gmb":
      return [
        "Plataforma: Google Business Profile (Posts/Updates).",
        "OBJETIVO: melhorar conversão local — quem busca a marca decide visitar/contatar.",
        "TOM DE VOZ: institucional acolhedor, claro, confiável. Pode ter 1 emoji discreto.",
        "FORMATO: 1 frase de oferta/novidade + 2-3 frases de benefício + CTA explícito ('Fale conosco', 'Agendar'). Sem hashtags. Até 1500 chars.",
      ].join("\n");
    default:
      return `Plataforma: ${platform}.`;
  }
}

function buildExportBlock(enr: any): string {
  if (!enr || typeof enr !== "object") return "(sem export Sistema A)";
  const parts: string[] = [];
  if (enr.name) parts.push(`Nome: ${enr.name}${enr.category ? " · " + enr.category : ""}`);
  if (enr.description) parts.push(`Descrição: ${enr.description}`);
  if (Array.isArray(enr.benefits) && enr.benefits.length) parts.push(`Benefícios: ${enr.benefits.join(" | ")}`);
  if (Array.isArray(enr.features) && enr.features.length) parts.push(`Features: ${enr.features.join(" | ")}`);
  if (enr.applications) parts.push(`Aplicações: ${enr.applications}`);
  if (enr.target_audience) parts.push(`Público-alvo: ${enr.target_audience}`);
  if (Array.isArray(enr.keywords) && enr.keywords.length) parts.push(`Keywords SEO: ${enr.keywords.join(", ")}`);
  if (Array.isArray(enr.tags) && enr.tags.length) parts.push(`Tags: ${enr.tags.join(", ")}`);
  if (Array.isArray(enr.faq_top) && enr.faq_top.length) {
    parts.push("FAQ-top:\n" + enr.faq_top.map((f: any) => `  Q: ${f.q}\n  A: ${f.a}`).join("\n"));
  }
  const yt = enr?.videos_top?.youtube || [];
  if (yt.length) {
    parts.push("Vídeos YouTube relacionados:\n" + yt.map((v: any) => `  - ${v.title || "(sem título)"} — ${v.url}`).join("\n"));
  }
  if (enr.product_url) parts.push(`URL do produto: ${enr.product_url}`);
  return parts.join("\n");
}

function buildPrompt(body: ReqBody, productCtx: any[], ragCtx: any[], exportEnr: any, extraCtx: any[]): string {
  const tone = body.tone || "Profissional";
  const lang = body.language || "pt-BR";
  const product = body.product_name || body.product_slug || "(produto não especificado)";

  const productBlock = productCtx.length
    ? productCtx
        .map((c) => `- [${c.source}] ${c.name || ""}${c.category ? " (" + c.category + ")" : ""}: ${c.text}`)
        .join("\n")
    : "(sem dados de catálogo encontrados)";

  const ragBlock = ragCtx.length
    ? ragCtx.map((c) => `- [${c.source}] ${c.title}: ${c.text}`).join("\n")
    : "(sem trechos adicionais)";

  const exportBlock = buildExportBlock(exportEnr);

  const extras = (body.extra_products || []).filter((p) => p?.name || p?.slug);
  const extraNames = extras.map((p) => p.name || p.slug).join(", ");
  const extraBlock = extraCtx.length
    ? extraCtx
        .map((c) => `- [${c.source}] ${c.name || ""}${c.category ? " (" + c.category + ")" : ""}: ${c.text}`)
        .join("\n")
    : "(nenhum produto complementar)";

  return `Você é o copywriter da marca **Smart Dent | Fluxo Digital** (impressão 3D e fluxo digital odontológico).

Gere um post para redes sociais sobre: **${product}**${extras.length ? ` em conjunto com: **${extraNames}**` : ""}.
${extras.length ? "Conduza a narrativa apresentando o produto principal e complementando com os demais (sinergia, fluxo integrado, vantagens combinadas)." : ""}

${platformGuidance(body.platform || "instagram")}
Tom: ${tone}. Idioma: ${lang}.

REGRAS OBRIGATÓRIAS:
- NÃO mencione preços, valores em R$, descontos, parcelamento ou condições comerciais.
- NÃO faça promessas regulatórias/clínicas absolutas.
- Caption: máximo ${MAX_CAPTION} caracteres. Use 1 gancho + benefícios + CTA.
- Hashtags: 8 a ${MAX_HASHTAGS} relevantes, sem o símbolo #, lowercase, sem espaços.
- Primeiro comentário: até ${MAX_COMMENT} chars, complementar (mais hashtags niche, link, CTA).

CONTEXTO DO PRODUTO (catálogo Smart Dent):
${productBlock}

PRODUTOS COMPLEMENTARES (para enriquecer o post):
${extraBlock}

EXPORT SISTEMA A (knowledge-export-full):
${exportBlock}

CONTEXTO ADICIONAL (base de conhecimento):
${ragBlock}

INSTRUÇÕES DO USUÁRIO:
${body.instructions?.trim() || "(nenhuma)"}

Responda APENAS com um JSON válido, sem markdown, no formato:
{"caption":"...","hashtags":["...","..."],"first_comment":"..."}`;
}

async function callLLM(prompt: string): Promise<{ caption: string; hashtags: string[]; first_comment: string; _model: string }> {
  const r = await aiComplete({
    task: "social_caption",
    functionName: "social-caption-generator",
    messages: [
      { role: "system", content: "Você devolve SEMPRE JSON válido sem cercas de código." },
      { role: "user", content: prompt },
    ],
    temperature: 0.7,
  });

  if (!r.ok) {
    console.error("[caption] ai-router falhou", JSON.stringify(r.attempts));
    const attemptsStr = JSON.stringify(r.attempts || []);
    const isCredits =
      /402|payment_required|not enough credits|used up your points|insufficient/i.test(
        attemptsStr + " " + (r.error || ""),
      );
    const isRateLimited = /429|rate.?limit/i.test(attemptsStr + " " + (r.error || ""));
    const err: any = new Error(r.error || "Falha ao chamar IA");
    err.code = isCredits
      ? "AI_CREDITS_EXHAUSTED"
      : isRateLimited
      ? "AI_RATE_LIMITED"
      : "AI_UNAVAILABLE";
    err.userMessage = isCredits
      ? "Créditos de IA esgotados. Use uma copy pronta do Sistema A ou escreva manualmente — quando os créditos forem recarregados, a geração volta automaticamente."
      : isRateLimited
      ? "IA temporariamente sobrecarregada. Aguarde alguns segundos e tente novamente."
      : "IA indisponível no momento. Use uma copy pronta ou escreva manualmente.";
    err.fallback = true;
    err.status = 200; // responder como fallback, não 5xx
    throw err;
  }
  const raw = r.text || "{}";
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // tenta extrair bloco JSON
    const m = String(raw).match(/\{[\s\S]*\}/);
    parsed = m ? JSON.parse(m[0]) : {};
  }
  const out = {
    caption: String(parsed.caption || "").slice(0, MAX_CAPTION),
    hashtags: sanitizeHashtags(parsed.hashtags),
    first_comment: String(parsed.first_comment || "").slice(0, MAX_COMMENT),
    _model: `${r.provider_used}/${r.model_used}`,
  };
  if (!out.caption) {
    const err: any = new Error("A IA retornou uma resposta vazia. Tente novamente com outra instrução.");
    err.status = 502;
    throw err;
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = (await req.json()) as ReqBody;
    if (!body.product_name && !body.product_slug && !body.instructions) {
      return new Response(
        JSON.stringify({ error: "Informe ao menos product_name, product_slug ou instructions." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const productCtx = await fetchProductContext(body.product_name, body.product_slug);
    const extraCtx: any[] = [];
    for (const ep of (body.extra_products || []).slice(0, 3)) {
      if (!ep?.name && !ep?.slug) continue;
      try {
        const c = await fetchProductContext(ep.name, ep.slug);
        if (c.length) extraCtx.push(...c.slice(0, 2));
      } catch (e) {
        console.warn("[caption] extra product ctx err", (e as Error).message);
      }
    }
    const ragQuery = [body.product_name, body.product_slug, body.instructions].filter(Boolean).join(" ").trim();
    const ragCtx = await fetchKnowledgeRag(ragQuery);

    let exportEnr: any = body.external_enrichment || null;
    let exportMatchedSlug: string | null = exportEnr?.slug || null;
    if (!exportEnr && (body.product_slug || body.product_name)) {
      try {
        const r = await fetch(`${SUPABASE_URL}/functions/v1/social-knowledge-fetch`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_ROLE}` },
          body: JSON.stringify({ product_slug: body.product_slug, product_name: body.product_name }),
        });
        if (r.ok) {
          const j = await r.json();
          if (j?.matched) {
            exportEnr = j.enrichment;
            exportMatchedSlug = j?.product?.slug || null;
          }
        }
      } catch (e) {
        console.warn("[caption] social-knowledge-fetch failed", (e as Error).message);
      }
    }

    const prompt = buildPrompt(body, productCtx, ragCtx, exportEnr, extraCtx);
    const result = await callLLM(prompt);

    return new Response(
      JSON.stringify({
        caption: result.caption,
        hashtags: result.hashtags,
        first_comment: result.first_comment,
        _meta: {
          product_hits: productCtx.length,
          extra_hits: extraCtx.length,
          rag_hits: ragCtx.length,
          export_hits: exportEnr ? 1 : 0,
          export_matched_slug: exportMatchedSlug,
          model: result._model,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const anyE = e as any;
    const status = anyE?.status ?? 500;
    console.error("[social-caption-generator]", status, (e as Error).message);
    if (anyE?.fallback) {
      return new Response(
        JSON.stringify({
          fallback: true,
          error: anyE.code || "AI_UNAVAILABLE",
          message: anyE.userMessage || (e as Error).message,
          caption: "",
          hashtags: [],
          first_comment: "",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    return new Response(JSON.stringify({ error: (e as Error).message || "Erro interno" }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});