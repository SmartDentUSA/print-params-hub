/**
 * training-testimonial-publish
 *
 * A partir de um depoimento já transcrito:
 *  1. monta contexto real da turma (curso, etapas, equipamentos) + RAG interna;
 *  2. gera o artigo da Categoria E (Depoimentos e Cursos) separando claramente
 *     a fala do participante do contexto institucional;
 *  3. valida (citações precisam existir na transcrição, sem preço/promessa);
 *  4. publica ou deixa em revisão (`publish: false` ou validação com erro);
 *  5. registra o vídeo em knowledge_videos, indexa na RAG e aciona o sitemap;
 *  6. cria o kit social pendente de aprovação (nunca publica em rede social).
 *
 * Body: { testimonial_id, publish?: boolean, regenerate?: boolean }
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { loadTrainingContext } from "../_shared/training-context.ts";
import { buildTrainingRagQuery, searchTrainingRag } from "../_shared/training-rag.ts";
import {
  authorizeTestimonialCall, CATEGORY_E_ID, chat, corsHeadersTestimonial, failTestimonial,
  jsonResponse, logEvent, parseJsonBlock, serviceClient, setStatus, slugify,
  validateTestimonialArticle,
} from "../_shared/testimonial-pipeline.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ARTICLE_PROMPT = `Você redige artigos da Base de Conhecimento da Smart Dent na Categoria E (Depoimentos e Cursos).

SEPARAÇÃO OBRIGATÓRIA:
1. A FALA DO PARTICIPANTE só pode vir da transcrição fornecida. Cite entre <blockquote> e use apenas trechos contínuos copiados da transcrição.
2. O CONTEXTO INSTITUCIONAL (curso, etapas, equipamentos, produtos) só pode vir do CONTEXTO DA TURMA e das FONTES INTERNAS fornecidas.
3. Nunca misture as duas coisas: não atribua ao participante nada que ele não disse, nem descreva o treinamento com informação que não esteja no contexto.

PROIBIDO: preço ou valor comercial, promessa de resultado clínico, garantia, superlativo não comprovável, dado numérico inventado, nome de produto que não esteja no contexto ou na fala.

ESTRUTURA do body_html (HTML simples: h2, h3, p, ul, li, blockquote):
- Abertura com o contexto real do treinamento (turma, curso, cidade quando houver).
- Seção "O que o participante contou" com as citações em <blockquote>.
- Seção de contexto técnico do treinamento baseada nas fontes internas.
- Fechamento com convite para conhecer o treinamento (sem preço e sem promessa).

Responda SOMENTE JSON:
{
  "title": "título com o nome do participante ou perfil e o tema",
  "slug": "slug-em-kebab-case",
  "meta_description": "70 a 165 caracteres",
  "excerpt": "resumo de 2 frases",
  "body_html": "<h2>...</h2>",
  "keywords": ["palavra-chave"],
  "quotes_used": ["citação exatamente como está na transcrição"],
  "faqs": [{"question": "...", "answer": "..."}],
  "social": {
    "instagram_caption": "legenda curta com CTA sem preço",
    "hashtags": ["#odontologiadigital"],
    "suggested_format": "reels|feed|stories"
  }
}`;

async function ensureUniqueSlug(db: any, base: string, ignoreId?: string | null): Promise<string> {
  const root = slugify(base) || `depoimento-${Date.now()}`;
  for (let i = 0; i < 25; i++) {
    const candidate = i === 0 ? root : `${root}-${i + 1}`;
    let q = db.from("knowledge_contents").select("id").eq("slug", candidate).limit(1);
    if (ignoreId) q = q.neq("id", ignoreId);
    const { data } = await q;
    if (!data || data.length === 0) return candidate;
  }
  return `${root}-${Date.now()}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeadersTestimonial });

  const auth = await authorizeTestimonialCall(req);
  if (!auth.ok) return jsonResponse({ error: auth.error }, auth.status);

  const db = serviceClient();
  let testimonialId: string | null = null;

  try {
    const { testimonial_id, publish = true } = await req.json().catch(() => ({}));
    if (!testimonial_id) return jsonResponse({ error: "testimonial_id obrigatório" }, 400);
    testimonialId = testimonial_id;

    const { data: t } = await db.from("training_testimonials").select("*").eq("id", testimonial_id).maybeSingle();
    if (!t) return jsonResponse({ error: "Depoimento não encontrado" }, 404);

    const transcript = String(t.transcript_revised || t.transcript_raw || "").trim();
    if (!transcript) return jsonResponse({ error: "Depoimento ainda não transcrito" }, 409);
    if (!t.enrollment_id && !t.companion_id) {
      return jsonResponse({ error: "Participante não identificado" }, 409);
    }
    if (t.analysis?.usable_for_publication === false) {
      const msg = `Transcrição marcada como não publicável: ${t.analysis?.reason_if_not || "sem conteúdo aproveitável"}`;
      await setStatus(db, t.id, "pending_review", { review_notes: msg });
      return jsonResponse({ status: "pending_review", reason: msg, testimonial_id: t.id }, 200);
    }

    await setStatus(db, t.id, "generating", { validation_errors: [] });
    await logEvent(db, t.id, "generation", "started", null, null, auth.actor);

    // ── Contexto real da turma ────────────────────────────────────────────
    const { data: turma } = await db
      .from("smartops_course_turmas")
      .select("*, smartops_courses(title, duration_days)")
      .eq("id", t.turma_id)
      .maybeSingle();
    if (!turma) throw new Error("Turma do depoimento não encontrada");
    const ctx = await loadTrainingContext(db, turma);

    // ── RAG interna (sem realimentar com depoimentos gerados) ─────────────
    const ragQuery = buildTrainingRagQuery({
      course_title: ctx.course.title,
      stage_topic: ctx.stages[0]?.topic ?? null,
      equipment: ctx.equipment,
      products: ctx.course.related_product_names,
      extra: (t.analysis?.topics || []).slice(0, 3).join(" "),
    });
    const rag = await searchTrainingRag(db, ragQuery, 8);
    const sources = rag.sources.filter((s) => s.source_type !== "training_testimonial");

    const contextBlock = [
      `CONTEXTO DA TURMA:`,
      `- Curso: ${ctx.course.title || "não informado"}`,
      `- Turma: ${ctx.turma.label || ctx.turma.turma_number || ctx.turma.id}`,
      `- Período: ${ctx.turma.start_date || "?"} a ${ctx.turma.end_date || "?"}`,
      `- Local/modalidade: ${ctx.turma.location || "não informado"} / ${ctx.turma.modality || "não informado"}`,
      `- Etapas: ${ctx.stages.map((s) => `Dia ${s.day_number}: ${s.topic || "sem tópico"}`).join(" | ") || "não informado"}`,
      `- Equipamentos citados nas inscrições: ${ctx.equipment.join(", ") || "não informado"}`,
      `- Produtos relacionados ao curso: ${ctx.course.related_product_names.join(", ") || "não informado"}`,
      ``,
      `FONTES INTERNAS (RAG):`,
      sources.length
        ? sources.map((s) => `- [${s.source_type}] ${s.title}: ${s.chunk}`).join("\n")
        : "(nenhuma fonte interna acima do limiar — não invente contexto técnico)",
    ].join("\n");

    const participantLine = [
      `Participante: ${t.participant_name || "não informado"}`,
      t.participant_snapshot?.especialidade ? `Especialidade: ${t.participant_snapshot.especialidade}` : "",
      t.participant_snapshot?.empresa_cidade ? `Cidade: ${t.participant_snapshot.empresa_cidade}` : "",
    ].filter(Boolean).join("\n");

    const articleRaw = await chat([
      { role: "system", content: ARTICLE_PROMPT },
      {
        role: "user",
        content: `${participantLine}\n\n${contextBlock}\n\nTRANSCRIÇÃO DO DEPOIMENTO (única fonte da fala):\n${transcript}`,
      },
    ], { json: true });
    const article = parseJsonBlock<any>(articleRaw);

    const slug = await ensureUniqueSlug(db, article.slug || article.title, t.knowledge_content_id);
    const errors = validateTestimonialArticle({
      title: String(article.title || ""),
      slug,
      meta_description: String(article.meta_description || ""),
      excerpt: String(article.excerpt || ""),
      content_html: String(article.body_html || ""),
      quotes: Array.isArray(article.quotes_used) ? article.quotes_used : [],
      transcript: `${t.transcript_raw || ""}\n${t.transcript_revised || ""}`,
    });

    const lowConfidence = Number(t.transcription_confidence ?? 1) < 0.7;
    if (lowConfidence) errors.push("Confiança da transcrição abaixo de 0,70 — revisão humana obrigatória");

    // ── Persistência do artigo (rascunho ou publicado) ─────────────────────
    const shouldPublish = publish === true && errors.length === 0;
    const payload = {
      category_id: CATEGORY_E_ID,
      title: String(article.title || "").slice(0, 200),
      slug,
      excerpt: String(article.excerpt || "").slice(0, 500),
      content_html: String(article.body_html || ""),
      meta_description: String(article.meta_description || "").slice(0, 200),
      keywords: Array.isArray(article.keywords) ? article.keywords.slice(0, 12) : [],
      faqs: Array.isArray(article.faqs) ? article.faqs : [],
      active: shouldPublish,
      created_by: "training-testimonial",
      draft_metadata: {
        testimonial_id: t.id,
        turma_id: t.turma_id,
        participant_name: t.participant_name,
        rag_sources: sources.map((s) => ({ type: s.source_type, title: s.title, score: s.score })),
        quotes_used: article.quotes_used || [],
        generated_at: new Date().toISOString(),
      },
    };

    let contentId = t.knowledge_content_id as string | null;
    if (contentId) {
      const { error } = await db.from("knowledge_contents").update(payload).eq("id", contentId);
      if (error) throw new Error(`Falha ao atualizar artigo: ${error.message}`);
    } else {
      const { data, error } = await db.from("knowledge_contents").insert(payload).select("id").single();
      if (error) throw new Error(`Falha ao criar artigo: ${error.message}`);
      contentId = data.id;
    }

    const publicUrl = `/base-conhecimento/e/${slug}`;

    // ── Vídeo do depoimento vinculado ao artigo ───────────────────────────
    let videoStatus = "sem_provedor";
    if (t.video_embed_url) {
      const { error: vErr } = await db.from("knowledge_videos").upsert({
        content_id: contentId,
        title: payload.title.slice(0, 180),
        url: t.video_embed_url,
        embed_url: t.video_embed_url,
        video_type: t.video_provider || "youtube",
        pandavideo_id: t.video_provider === "pandavideo" ? t.video_provider_id : null,
        description: payload.excerpt,
        video_transcript: transcript,
        order_index: 0,
        source: "training_testimonial",
      }, { onConflict: "content_id,url" });
      videoStatus = vErr ? `erro: ${vErr.message}` : "vinculado";
    }

    // ── Indexação na RAG (fonte identificada, sem realimentar a si mesma) ──
    let ragChunks = 0;
    if (shouldPublish) {
      try {
        const { generateTextEmbedding } = await import("../_shared/generate-embedding.ts");
        const plain = String(article.body_html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        const chunks: string[] = [];
        for (let i = 0; i < plain.length; i += 750) chunks.push(plain.slice(i, i + 900));
        await db.from("agent_embeddings").delete().contains("metadata", { testimonial_id: t.id });
        for (const chunk of chunks.slice(0, 12)) {
          const embedding = await generateTextEmbedding(chunk, "RETRIEVAL_DOCUMENT");
          if (!embedding) continue;
          const { error } = await db.from("agent_embeddings").insert({
            source_type: "training_testimonial",
            content_id: contentId,
            chunk_text: chunk,
            embedding,
            metadata: {
              testimonial_id: t.id, turma_id: t.turma_id, title: payload.title,
              url: publicUrl, participant_name: t.participant_name, source: "training_testimonial",
            },
          });
          if (!error) ragChunks++;
        }
      } catch (e) {
        await logEvent(db, t.id, "rag_index", "error", String((e as Error).message));
      }

      // Sitemap (fire-and-forget)
      try {
        await fetch(`${SUPABASE_URL}/functions/v1/generate-knowledge-sitemap`, {
          method: "POST",
          headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY },
        });
      } catch { /* sitemap não bloqueia publicação */ }
    }

    // ── Kit social pendente de aprovação (nunca publica sozinho) ──────────
    const kitRunId = t.social_kit_run_id || crypto.randomUUID();
    try {
      const { error: dErr } = await db.from("training_social_deliverables").insert({
        turma_id: t.turma_id,
        kit_run_id: kitRunId,
        platform: "instagram",
        post_type: article.social?.suggested_format === "feed" ? "feed" : "reels",
        caption: article.social?.instagram_caption || payload.excerpt,
        hashtags: Array.isArray(article.social?.hashtags) ? article.social.hashtags : [],
        title: payload.title,
        description: payload.excerpt,
        status: "pending_review",
        agent_source: "training-testimonial-publish",
        suggested_at: new Date().toISOString(),
        rag_context_snapshot: { query: rag.query, sources: sources.map((s) => ({ type: s.source_type, title: s.title })) },
        copy_context_snapshot: {
          testimonial_id: t.id,
          knowledge_content_id: contentId,
          public_url: publicUrl,
          participant_name: t.participant_name,
          drive_file_id: t.drive_file_id,
        },
      });
      if (dErr) throw new Error(dErr.message);
    } catch (e) {
      await logEvent(db, t.id, "social_kit", "error", String((e as Error).message));
    }

    const finalStatus = shouldPublish ? (ragChunks > 0 ? "rag_available" : "published") : (errors.length ? "validation_failed" : "pending_review");
    await setStatus(db, t.id, finalStatus, {
      knowledge_content_id: contentId,
      knowledge_slug: slug,
      public_url: publicUrl,
      validation_errors: errors,
      rag_chunks: ragChunks,
      social_kit_run_id: kitRunId,
      rag_indexed_at: ragChunks > 0 ? new Date().toISOString() : null,
      sitemap_pinged_at: shouldPublish ? new Date().toISOString() : null,
      video_publish_status: videoStatus,
      rag_context_snapshot: { query: rag.query, threshold: rag.threshold, sources },
      review_notes: errors.length ? errors.join(" | ").slice(0, 2000) : null,
    });
    await logEvent(db, t.id, "generation", errors.length ? "blocked" : "success",
      errors.length ? errors.join(" | ") : "Artigo gerado", { slug, published: shouldPublish, rag_chunks: ragChunks }, auth.actor);

    return jsonResponse({
      status: finalStatus,
      testimonial_id: t.id,
      knowledge_content_id: contentId,
      slug,
      public_url: publicUrl,
      published: shouldPublish,
      validation_errors: errors,
      rag_chunks: ragChunks,
      rag_sources: sources.length,
    });
  } catch (e) {
    const msg = String((e as Error).message || e);
    console.error("[training-testimonial-publish]", msg);
    if (testimonialId) await failTestimonial(db, testimonialId, "generation", msg).catch(() => {});
    return jsonResponse({ error: msg, testimonial_id: testimonialId }, 500);
  }
});