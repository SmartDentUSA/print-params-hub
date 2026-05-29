/**
 * copilot-draft-knowledge-article
 *
 * Gera um rascunho de artigo para o Knowledge Base, ancorado em:
 * - `smartdent_method_docs` (RAG da doutrina Smart Dent)
 * - `knowledge_contents` existentes (FTS — evita canibalização/duplicação)
 *
 * Salva como rascunho (active=false, created_by='copilot') e devolve preview.
 * NÃO publica — usar `copilot-publish-knowledge-article` para isso.
 *
 * Body: {
 *   topic: string,                    // obrigatório
 *   target_audience?: string[],
 *   target_products?: string[],
 *   category_letter?: "A"|"B"|"C"|"D"|"E"|"F",  // dica
 *   tone?: string,
 *   draft_id?: string,                // se passado: edita rascunho existente
 *   revise_instructions?: string,     // se passado: revisão guiada
 * }
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getAdminClient, matchMethodDocs } from "../_shared/method-docs-rag.ts";
import { cleanSlug, validateDraft } from "../_shared/article-validators.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const DRAFT_MODEL = "google/gemini-3.1-pro-preview";

const CATEGORY_BY_LETTER: Record<string, string> = {
  A: "45243aad-7143-4bc8-a649-05f741992e07", // Vídeos Tutoriais
  B: "83d0b6ea-59d7-4d98-80a1-ac7df83b697a", // Falhas, como resolver
  C: "fc493982-ad8c-417f-9579-82786a97925a", // Ciência e tecnologia
  D: "67b81704-64f8-4739-b79f-24f46f70752c", // Casos Clínicos
  E: "ff524477-c553-4518-868e-8435e16a5c57", // Depoimentos e Cursos
  F: "67f92f1b-ea9e-42b9-94d1-7d685e25629c", // Parâmetros Técnicos
};

const SYSTEM_PROMPT = `Você é o time editorial da Smart Dent | Fluxo Digital escrevendo artigos para a Base de Conhecimento pública.

REGRAS DURAS (não-negociáveis):
1. NUNCA cite preços, valores, R$, USD, "preço", "custa", "vendido por".
2. NUNCA invente specs técnicas, integrações, compatibilidades ou prazos. Use APENAS o que está nos trechos do RAG e no catálogo injetados.
3. NUNCA prometa entregas, datas ou condições comerciais.
4. Tom: técnico-consultivo, primeira pessoa "nós/Smart Dent", direto e útil para o profissional dentista/protodontista.
5. Estrutura mínima do body_md:
   - H1 ao topo
   - Parágrafo de contexto/dor (2-4 linhas)
   - 2-4 seções H2 com explicação técnica, sem floreio
   - Quando aplicável, lista do workflow 7×3 (Smart Dent)
   - Bloco final com CTA para WhatsApp
6. CTA WhatsApp obrigatório no final: "Fale com nosso time no WhatsApp" (sem prometer preço/prazo).
7. Slug em kebab-case, sem acento, ≤ 80 chars.
8. Title ≤ 65 chars, com a palavra-chave principal no início.
9. Meta description 120-160 chars.
10. FAQ: 3-5 perguntas reais que o lead faria, respondidas com base no RAG (sem preço).

SAÍDA: JSON puro, sem markdown ao redor, no schema:
{
  "title": string,
  "slug": string,
  "meta_description": string,
  "excerpt": string,                 // 2 linhas, vai no topo
  "category_letter": "A"|"B"|"C"|"D"|"E"|"F",
  "keywords": string[],              // 4-8 termos
  "body_md": string,                 // markdown completo, 700-1500 palavras
  "faqs": [{"question": string, "answer": string}],
  "cta_whatsapp": string,            // texto curto do CTA
  "rationale": string                // 2 linhas: por que este ângulo
}`;

async function callLLM(messages: any[], maxTokens = 4500): Promise<any> {
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY ausente");
  const resp = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
    },
    body: JSON.stringify({
      model: DRAFT_MODEL,
      messages,
      temperature: 0.55,
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
    }),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`LLM ${resp.status}: ${t.slice(0, 300)}`);
  }
  const j = await resp.json();
  const content = j?.choices?.[0]?.message?.content || "{}";
  return JSON.parse(content);
}

async function ensureUniqueSlug(slug: string, ignoreId?: string): Promise<string> {
  const supabase = getAdminClient();
  const base = cleanSlug(slug) || "artigo-smart-dent";
  let candidate = base;
  let n = 1;
  while (true) {
    let q = supabase.from("knowledge_contents").select("id").eq("slug", candidate).limit(1);
    if (ignoreId) q = q.neq("id", ignoreId);
    const { data } = await q;
    if (!data || data.length === 0) return candidate;
    n++;
    candidate = `${base}-${n}`;
    if (n > 50) return `${base}-${Date.now()}`;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const {
      topic,
      target_audience,
      target_products,
      category_letter,
      tone,
      draft_id,
      revise_instructions,
    } = body || {};

    if (!topic && !draft_id) {
      return new Response(JSON.stringify({ error: "topic ou draft_id obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = getAdminClient();

    // ─── Revisão de rascunho existente ───
    let existingDraft: any = null;
    if (draft_id) {
      const { data, error } = await supabase
        .from("knowledge_contents")
        .select("*, knowledge_categories(letter)")
        .eq("id", draft_id)
        .single();
      if (error || !data) {
        return new Response(JSON.stringify({ error: "rascunho não encontrado" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      existingDraft = data;
    }

    // ─── RAG: doutrina Smart Dent ───
    const ragQuery = topic || existingDraft?.title || "";
    const ragHits = await matchMethodDocs({
      query: ragQuery,
      audience: target_audience,
      products: target_products,
      matchCount: 10,
      threshold: 0.5,
    });

    // ─── Anti-canibalização: artigos similares já existentes ───
    const { data: similar } = await supabase
      .from("knowledge_contents")
      .select("id,title,slug,excerpt")
      .eq("active", true)
      .textSearch("title", ragQuery.split(/\s+/).slice(0, 4).join(" "), { type: "websearch" })
      .limit(5);

    // ─── Contexto pro LLM ───
    const ragBlock =
      ragHits.length === 0
        ? "(RAG vazio — não há doutrina indexada sobre este tema. Seja explícito sobre isso.)"
        : ragHits
            .map(
              (h, i) =>
                `[#${i + 1}] (${h.doc_type} | similarity=${h.similarity.toFixed(2)})\n${h.title}\n${h.body_md}`,
            )
            .join("\n\n---\n\n");

    const similarBlock = (similar || []).length
      ? (similar || [])
          .map((s: any) => `- ${s.title} (/base-conhecimento/.../${s.slug})`)
          .join("\n")
      : "(nenhum artigo concorrente encontrado)";

    const userPayload = existingDraft
      ? `MODO: REVISÃO de rascunho existente.

RASCUNHO ATUAL:
${JSON.stringify(
  {
    title: existingDraft.title,
    slug: existingDraft.slug,
    meta_description: existingDraft.meta_description,
    excerpt: existingDraft.excerpt,
    body_md: existingDraft.content_html,
    faqs: existingDraft.faqs,
    category_letter: existingDraft.knowledge_categories?.letter,
  },
  null,
  2,
).slice(0, 6000)}

INSTRUÇÕES DA REVISÃO:
${revise_instructions || "Reforçar clareza, encurtar parágrafos longos."}

RAG ATUALIZADO (doutrina indexada):
${ragBlock}`
      : `TÓPICO: ${topic}
PÚBLICO: ${(target_audience || []).join(", ") || "geral"}
PRODUTOS: ${(target_products || []).join(", ") || "—"}
CATEGORIA SUGERIDA: ${category_letter || "auto (escolha A-F)"}
TOM: ${tone || "consultivo-técnico"}

DOUTRINA INDEXADA (use APENAS isto + catálogo público para qualquer afirmação técnica):
${ragBlock}

ARTIGOS EXISTENTES (não duplique; ângulo diferente):
${similarBlock}`;

    // ─── LLM ───
    const draftJson = await callLLM([
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPayload },
    ]);

    // ─── Validação ───
    const validation = validateDraft(draftJson);
    if (!validation.ok) {
      return new Response(
        JSON.stringify({
          error: "draft_validation_failed",
          validation_errors: validation.errors,
          partial_draft: draftJson,
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const finalLetter = String(draftJson.category_letter || category_letter || "C").toUpperCase();
    const categoryId = CATEGORY_BY_LETTER[finalLetter] || CATEGORY_BY_LETTER.C;

    const slug = await ensureUniqueSlug(draftJson.slug || draftJson.title, draft_id);

    // ─── Persistência ───
    const payload: any = {
      category_id: categoryId,
      title: String(draftJson.title).slice(0, 200),
      slug,
      excerpt: String(draftJson.excerpt || "").slice(0, 500),
      content_html: String(draftJson.body_md || ""),
      meta_description: String(draftJson.meta_description || "").slice(0, 200),
      keywords: Array.isArray(draftJson.keywords) ? draftJson.keywords.slice(0, 12) : [],
      faqs: Array.isArray(draftJson.faqs) ? draftJson.faqs : [],
      icon_color: "#9333ea",
      active: false,
      created_by: "copilot",
      source_method_docs: ragHits.map((h) => h.id),
      draft_metadata: {
        topic,
        target_audience,
        target_products,
        tone,
        model: DRAFT_MODEL,
        rag_hits: ragHits.length,
        similar_titles: (similar || []).map((s: any) => s.title),
        cta_whatsapp: draftJson.cta_whatsapp,
        rationale: draftJson.rationale,
        generated_at: new Date().toISOString(),
      },
    };

    let saved: any;
    if (draft_id) {
      const { data, error } = await supabase
        .from("knowledge_contents")
        .update(payload)
        .eq("id", draft_id)
        .select()
        .single();
      if (error) throw new Error(`update draft: ${error.message}`);
      saved = data;
    } else {
      const { data, error } = await supabase
        .from("knowledge_contents")
        .insert(payload)
        .select()
        .single();
      if (error) throw new Error(`insert draft: ${error.message}`);
      saved = data;
    }

    return new Response(
      JSON.stringify({
        success: true,
        draft_id: saved.id,
        title: saved.title,
        slug: saved.slug,
        meta_description: saved.meta_description,
        excerpt: saved.excerpt,
        category_letter: finalLetter,
        body_preview: String(saved.content_html || "").slice(0, 500),
        body_chars: String(saved.content_html || "").length,
        faqs_count: Array.isArray(saved.faqs) ? saved.faqs.length : 0,
        rag_sources: ragHits.length,
        status: "draft",
        publish_url_preview: `/base-conhecimento/${finalLetter.toLowerCase()}/${saved.slug}`,
        rationale: draftJson.rationale,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[copilot-draft-knowledge-article] error:", e);
    return new Response(
      JSON.stringify({ error: (e as Error).message || "erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});