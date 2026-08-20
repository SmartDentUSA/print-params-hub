/**
 * knowledge-content-modernize
 *
 * Normaliza conteúdo LEGADO da Base de Conhecimento no padrão editorial atual:
 *  1. reescreve o corpo com o prompt novo (contexto real do participante/turma),
 *     ancorado APENAS no texto já publicado — nada de invenção;
 *  2. preserva os blocos canônicos (ficha, transcrição completa, JSON-LD) e a URL
 *     (slug e título não mudam);
 *  3. reescreve as FAQs com as premissas SEO + AEO (Google/AI Overview, ChatGPT,
 *     Claude, Perplexity — inclusive intenção de decisão: vale a pena investir no
 *     digital, é rentável, qual empresa comprar scanner);
 *  4. aplica o padrão único de formatação HTML.
 *
 * Body: { contentId, force?, skipNew? }
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";
import { applyStandardFormatting, generateAeoFaqs, stripMarkdownCodeFences } from "../_shared/article-format.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** Conteúdo já gerado pelo pipeline novo — não reprocessar (a menos que force). */
const NEW_PIPELINE_CUTOFF = "2026-08-01T00:00:00Z";

const MODERNIZE_PROMPT = `Você é redator sênior de SEO/GEO/AEO da Base de Conhecimento da Smart Dent. Escreve em português do Brasil, tom editorial técnico, jamais publicitário raso.

TAREFA: reescrever um artigo LEGADO no padrão editorial atual, usando SOMENTE as informações já presentes no artigo original e na ficha real fornecida.

🚫 ANTI-ALUCINAÇÃO (prioridade máxima)
- Nunca crie fato, número, estudo, prazo, cidade, especialidade, equipamento, produto ou fala que não esteja no material fornecido.
- Citações do participante (<blockquote>) só se a frase existir literalmente no artigo original/transcrição.
- Proibido: preço ou valor comercial, promessa de resultado clínico, garantia, superlativo não comprovável, marca concorrente.
- Se a ficha não trouxer cidade/UF, não invente localidade.

PADRÃO OBRIGATÓRIO
- Abra com <p><strong>Resumo:</strong> ...</p> (TL;DR de 2 a 3 frases, citável por IA, respondendo quem/onde/o quê/o que mudou).
- Corpo entre 550 e 900 palavras, parágrafos de 2 a 4 frases, sem frases genéricas de marketing.
- Cada h2/h3 é uma pergunta ou tema pesquisável (long tail), usando quando o material sustentar: odontologia digital, escaneamento intraoral, impressão 3D, resina 3D, fluxo digital, CAD/CAM.
- Amarração GEO: cite "Cidade (UF)" ao menos 2 vezes (abertura e fechamento) quando houver na ficha, relacionando a especialidade ao conteúdo.
- Inclua uma <ul> com pontos concretos do fluxo/treinamento extraídos do material.
- Capitalização editorial: nunca CAIXA ALTA para nome, cidade, especialidade ou área ("Implantodontista", "Clínica ou consultório"). Só siglas e UF em maiúsculas.
- Fechamento com convite sóbrio para conhecer o treinamento/solução, sem preço e sem promessa.
- HTML simples: h2, h3, p, ul, li, blockquote, strong. NÃO inclua ficha do participante, transcrição completa nem JSON-LD (esses blocos são anexados pelo sistema).

Responda SOMENTE JSON válido:
{"body_html":"<p><strong>Resumo:</strong> ...","excerpt":"resumo de 2 frases","meta_description":"120 a 160 caracteres","keywords":["..."]}`;

function extractBlock(html: string, startRe: RegExp, endRe?: RegExp): string | null {
  const m = startRe.exec(html);
  if (!m) return null;
  const from = m.index;
  if (!endRe) return html.slice(from);
  endRe.lastIndex = from + m[0].length;
  const e = endRe.exec(html);
  return html.slice(from, e ? e.index : undefined);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const { contentId, force = false, skipNew = true } = await req.json();
    if (!contentId) throw new Error("contentId é obrigatório");

    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: art, error } = await db
      .from("knowledge_contents")
      .select("id, title, slug, content_html, faqs, excerpt, meta_description, keywords, created_at, created_by, draft_metadata, content_modernized_at")
      .eq("id", contentId)
      .single();
    if (error || !art) throw new Error(`Artigo não encontrado: ${error?.message}`);
    if (!art.content_html) throw new Error("Artigo sem content_html");

    if (!force && (art as any).content_modernized_at) {
      return json({ success: true, skipped: true, reason: "já modernizado", modernized_at: (art as any).content_modernized_at });
    }
    const generatedByNewPipeline = Boolean((art.draft_metadata as any)?.generated_at) &&
      String(art.created_at) >= NEW_PIPELINE_CUTOFF;
    if (!force && skipNew && generatedByNewPipeline) {
      return json({ success: true, skipped: true, reason: "conteúdo do pipeline novo" });
    }

    const html = art.content_html as string;

    // Blocos canônicos preservados na íntegra.
    const fichaBlock = extractBlock(html, /<h2[^>]*>\s*Ficha do participante/i, /<h2[^>]*>/gi);
    const transcriptBlock = extractBlock(html, /<h2[^>]*>\s*Transcri[çc][ãa]o completa/i, /<script[^>]*application\/ld\+json/gi);
    const jsonLd = (html.match(/<script[^>]*application\/ld\+json[\s\S]*?<\/script>/i) || [null])[0];

    // Ficha real: metadata do pipeline ou o próprio depoimento vinculado.
    let ficha: Record<string, unknown> | null = (art.draft_metadata as any)?.participant_ficha ?? null;
    if (!ficha) {
      const { data: t } = await db
        .from("training_testimonials")
        .select("participant_name, participant_snapshot, turma_id")
        .eq("knowledge_content_id", art.id)
        .maybeSingle();
      if (t) ficha = (t.participant_snapshot as any) || { nome: t.participant_name };
    }

    const plain = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/\s+/g, " ")
      .slice(0, 26000);

    const { aiComplete } = await import("../_shared/ai-router.ts");
    const r = await aiComplete({
      task: "content_seo",
      functionName: "knowledge-content-modernize",
      messages: [
        { role: "system", content: MODERNIZE_PROMPT },
        {
          role: "user",
          content: [
            `TÍTULO ATUAL (não alterar): ${art.title}`,
            ficha ? `FICHA REAL (única fonte de nome/cidade/UF/especialidade):\n${JSON.stringify(ficha)}` : "SEM FICHA — não cite localidade nem especialidade.",
            `ARTIGO ORIGINAL (única fonte factual):\n${plain}`,
          ].join("\n\n"),
        },
      ],
      temperature: 0.5,
      maxTokens: 8000,
    });
    if (!r.ok || !r.text) throw new Error(`IA falhou: ${r.error || "sem resposta"}`);

    let gen: any = {};
    try { gen = JSON.parse(stripMarkdownCodeFences(r.text)); } catch { throw new Error("IA não retornou JSON válido"); }
    const body = String(gen.body_html || "").trim();
    if (body.length < 800) throw new Error("Corpo gerado curto demais — abortado para não degradar o artigo");

    const composed = [fichaBlock, body, transcriptBlock, jsonLd].filter(Boolean).join("\n");
    const formatted = await applyStandardFormatting({
      title: art.title, html: composed, lang: "pt", functionName: "knowledge-content-modernize",
    });

    const faqs = await generateAeoFaqs({
      title: art.title,
      html: formatted,
      lang: "pt",
      existingFaqs: Array.isArray(art.faqs) ? art.faqs as any : [],
      extraContext: ficha ? JSON.stringify(ficha) : undefined,
      functionName: "knowledge-content-modernize",
    });

    const now = new Date().toISOString();
    const payload: Record<string, unknown> = {
      content_html: formatted,
      content_modernized_at: now,
      content_html_reformatted_at: now,
      updated_at: now,
    };
    if (faqs.length) { payload.faqs = faqs; payload.faqs_aeo_at = now; }
    if (gen.excerpt) payload.excerpt = String(gen.excerpt).slice(0, 500);
    if (gen.meta_description) payload.meta_description = String(gen.meta_description).slice(0, 200);
    if (Array.isArray(gen.keywords) && gen.keywords.length) {
      const merged = new Set<string>([...(art.keywords || []), ...gen.keywords.map((k: unknown) => String(k))]);
      payload.keywords = Array.from(merged).slice(0, 20);
    }

    const { error: upErr } = await db.from("knowledge_contents").update(payload).eq("id", art.id);
    if (upErr) throw new Error(`Falha ao salvar: ${upErr.message}`);

    return json({
      success: true,
      contentId: art.id,
      title: art.title,
      before: html.length,
      after: formatted.length,
      faqs: faqs.length,
      preserved: { ficha: Boolean(fichaBlock), transcript: Boolean(transcriptBlock), json_ld: Boolean(jsonLd) },
    });
  } catch (e) {
    console.error("[knowledge-content-modernize]", (e as Error).message);
    return json({ success: false, error: (e as Error).message }, 500);
  }
});
