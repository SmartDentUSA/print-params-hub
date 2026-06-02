import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
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
      return "Plataforma: Instagram/Facebook. Use quebras de linha, emojis com parcimônia, CTA claro ao final, 4-7 linhas curtas.";
    case "tiktok":
      return "Plataforma: TikTok. Caption curta (até 150 chars), gancho forte na 1ª frase, sem formatação longa.";
    case "youtube":
      return "Plataforma: YouTube Shorts. Caption objetiva, foco em curiosidade e CTA para canal.";
    case "linkedin":
      return "Plataforma: LinkedIn. Tom profissional, abertura provocativa, 6-10 linhas, sem emojis em excesso.";
    case "pinterest":
      return "Plataforma: Pinterest. Descrição rica em palavras-chave, focada em busca.";
    default:
      return `Plataforma: ${platform}.`;
  }
}

function buildPrompt(body: ReqBody, productCtx: any[], ragCtx: any[]): string {
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

  return `Você é o copywriter da marca **Smart Dent | Fluxo Digital** (impressão 3D e fluxo digital odontológico).

Gere um post para redes sociais sobre: **${product}**.

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

CONTEXTO ADICIONAL (base de conhecimento):
${ragBlock}

INSTRUÇÕES DO USUÁRIO:
${body.instructions?.trim() || "(nenhuma)"}

Responda APENAS com um JSON válido, sem markdown, no formato:
{"caption":"...","hashtags":["...","..."],"first_comment":"..."}`;
}

async function callLLM(prompt: string): Promise<{ caption: string; hashtags: string[]; first_comment: string }> {
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY ausente");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Lovable-API-Key": LOVABLE_API_KEY,
      "X-Lovable-AIG-SDK": "edge-function",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-lite",
      messages: [
        { role: "system", content: "Você devolve SEMPRE JSON válido sem cercas de código." },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    console.error("[caption] LLM error", res.status, txt.slice(0, 500));
    const err: any = new Error(
      res.status === 402
        ? "Créditos Lovable AI esgotados. Adicione créditos em Settings > Workspace > Usage."
        : res.status === 429
          ? "Limite de requisições atingido. Tente novamente em alguns segundos."
          : `LLM ${res.status}: ${txt.slice(0, 200)}`,
    );
    err.status = res.status;
    throw err;
  }
  const json = await res.json();
  const raw = json?.choices?.[0]?.message?.content || "{}";
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
    const ragQuery = [body.product_name, body.product_slug, body.instructions].filter(Boolean).join(" ").trim();
    const ragCtx = await fetchKnowledgeRag(ragQuery);

    const prompt = buildPrompt(body, productCtx, ragCtx);
    const result = await callLLM(prompt);

    return new Response(
      JSON.stringify({
        ...result,
        _meta: {
          product_hits: productCtx.length,
          rag_hits: ragCtx.length,
          model: "google/gemini-2.5-flash-lite",
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const status = (e as any)?.status ?? 500;
    console.error("[social-caption-generator]", status, (e as Error).message);
    return new Response(JSON.stringify({ error: (e as Error).message || "Erro interno" }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});