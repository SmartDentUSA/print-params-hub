/**
 * training-testimonial-social-publish
 *
 * Depois que o depoimento é publicado na Base de Conhecimento, publica o MESMO
 * vídeo no Story do Instagram e no TikTok, com copy gerada pela IA a partir dos
 * dados reais do treinamento (curso, turma, produtos relacionados) e da ficha
 * pública do participante (nome, cidade/UF, especialidade).
 *
 * Regras:
 *  - CTA obrigatório: "Quer saber mais sobre este treinamento? Link na Bio".
 *  - Se o participante (ou acompanhante) tiver @ do Instagram cadastrado, ele é
 *    marcado na copy do Story; no TikTok o @ entra citado no texto.
 *  - Nada de preço, promessa clínica ou dado privado (clínica, CNPJ, telefone).
 *  - Idempotente: um depoimento gera UMA publicação social (social_story_post_id).
 *  - A publicação é feita pelo social-publish-worker (mesmo caminho do Publisher).
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  authorizeTestimonialCall, chat, corsHeadersTestimonial, jsonResponse, logEvent,
  parseJsonBlock, safeEqualSecret, serviceClient,
} from "../_shared/testimonial-pipeline.ts";
import { loadTrainingContext, normalizeInstagram } from "../_shared/training-context.ts";
import { normalizeForMatch } from "../_shared/testimonial-pipeline.ts";
import { buildAccessUrls } from "../_shared/training-media-access.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const CTA = "Quer saber mais sobre este treinamento? Link na Bio";

/** Parceiros fixos marcados em TODO depoimento (Story do IG + TikTok). */
const PARTNER_HANDLES = ["rayshape3d", "blz_dental"];
const PARTNER_LINE = `Parceria: ${PARTNER_HANDLES.map((h) => `@${h}`).join(" ")}`;

/** Palavra-chave de comentário para o fluxo comment-to-DM (ex.: "EDGE", "RAYSHAPE"). */
function commentKeyword(courseTitle?: string | null): string {
  const words = String(courseTitle || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9\s]/g, " ")
    .split(/\s+/).filter((w) => w.length >= 4 && !/^(curso|treinamento|para|com|print|mini)$/i.test(w));
  return (words[0] || "TREINAMENTO").toUpperCase().slice(0, 12);
}

function titleCasePt(input?: string | null): string | null {
  const s = String(input || "").trim();
  if (!s) return null;
  const keep = new Set(["SP", "RJ", "MG", "ES", "PR", "SC", "RS", "BA", "GO", "DF", "3D", "CAD", "CAM", "CAD/CAM"]);
  const lower = new Set(["de", "da", "do", "das", "dos", "e", "em", "para", "com", "ou", "a", "o"]);
  return s.split(/\s+/).map((w, i) => {
    const up = w.toUpperCase();
    if (keep.has(up)) return up;
    const l = w.toLowerCase();
    if (i > 0 && lower.has(l)) return l;
    return l.charAt(0).toUpperCase() + l.slice(1);
  }).join(" ");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeadersTestimonial });

  const cronKey = (Deno.env.get("TESTIMONIAL_CRON_KEY") || "").trim();
  const headerCron = (req.headers.get("x-cron-key") || "").trim();
  const isCron = Boolean(cronKey && headerCron && safeEqualSecret(headerCron, cronKey));
  let actor: string | null = "cron";
  if (!isCron) {
    const auth = await authorizeTestimonialCall(req);
    if (!auth.ok) return jsonResponse({ error: auth.error }, auth.status);
    actor = (auth as any).actor ?? null;
  }

  const db = serviceClient();
  let testimonialId: string | null = null;

  try {
    const body = await req.json().catch(() => ({} as any));
    testimonialId = body?.testimonial_id ? String(body.testimonial_id) : null;
    const force = body?.force === true;
    const dryRun = body?.dry_run === true;
    if (!testimonialId) return jsonResponse({ error: "testimonial_id obrigatório" }, 400);

    const { data: t, error } = await db
      .from("training_testimonials")
      .select("*")
      .eq("id", testimonialId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!t) return jsonResponse({ error: "Depoimento não encontrado" }, 404);

    if (!["published", "rag_available", "indexed"].includes(String(t.status))) {
      return jsonResponse({ status: "skipped", reason: `depoimento ainda não publicado (${t.status})` }, 200);
    }
    if (t.social_story_post_id && !force) {
      return jsonResponse({ status: "already_published", post_id: t.social_story_post_id }, 200);
    }
    if (!t.drive_file_id) return jsonResponse({ error: "Depoimento sem arquivo no Drive" }, 400);

    const transcript = String(t.transcript_revised || t.transcript_raw || "").slice(0, 6000);
    if (!transcript) return jsonResponse({ error: "Sem transcrição para gerar a copy" }, 400);

    const { data: turma } = await db
      .from("smartops_course_turmas")
      .select("*, smartops_courses(title, duration_days)")
      .eq("id", t.turma_id)
      .maybeSingle();
    if (!turma) throw new Error("Turma do depoimento não encontrada");
    const ctx = await loadTrainingContext(db, turma);

    // ── Ficha pública + @ do participante ────────────────────────────────
    const snap: any = t.participant_snapshot || {};
    let handle: string | null = null;
    // O @ só é usado se pertencer comprovadamente ao participante do depoimento —
    // a inscrição pode ser do titular e o depoimento de outra pessoa da clínica.
    let handleOwner: string | null = null;
    if (t.enrollment_id) {
      const { data: enr } = await db
        .from("smartops_course_enrollments")
        .select("person_name, instagram, especialidade, area_atuacao, empresa_cidade, empresa_estado, lead_id")
        .eq("id", t.enrollment_id)
        .maybeSingle();
      if (enr) {
        if (normalizeInstagram(enr.instagram)) {
          handle = normalizeInstagram(enr.instagram);
          handleOwner = enr.person_name || null;
        }
        snap.nome = snap.nome || enr.person_name;
        snap.especialidade = snap.especialidade || enr.especialidade;
        snap.area_atuacao = snap.area_atuacao || enr.area_atuacao;
        snap.empresa_cidade = snap.empresa_cidade || enr.empresa_cidade;
        snap.empresa_estado = snap.empresa_estado || enr.empresa_estado;
      }
    }
    if (t.companion_id) {
      const { data: comp } = await db
        .from("smartops_enrollment_companions")
        .select("name, instagram, especialidade, area_atuacao")
        .eq("id", t.companion_id)
        .maybeSingle();
      if (comp) {
        if (normalizeInstagram(comp.instagram)) {
          handle = normalizeInstagram(comp.instagram);
          handleOwner = comp.name || null;
        }
        snap.nome = comp.name || snap.nome;
        snap.especialidade = comp.especialidade || snap.especialidade;
        snap.area_atuacao = comp.area_atuacao || snap.area_atuacao;
      }
    }

    const participantName = String(t.participant_name || snap.nome || "");
    if (handle) {
      const a = normalizeForMatch(participantName).split(" ").filter(Boolean);
      const b = normalizeForMatch(handleOwner || "").split(" ").filter(Boolean);
      const sameOwner = a.length > 0 && b.length > 0 && a[0] === b[0] && (
        a.length === 1 || b.length === 1 || a[a.length - 1] === b[b.length - 1]
      );
      if (!sameOwner) {
        await logEvent(db, t.id, "social_publish", "warning",
          "@ do Instagram descartado: cadastro é de outra pessoa", { handle_owner: handleOwner, participant: participantName }, actor);
        handle = null;
      }
    }

    const ficha = {
      nome: titleCasePt(t.participant_name || snap.nome) || "Participante",
      cidade: titleCasePt(snap.empresa_cidade),
      uf: snap.empresa_estado ? String(snap.empresa_estado).toUpperCase() : null,
      especialidade: titleCasePt(snap.especialidade) || titleCasePt(snap.area_atuacao),
      curso: ctx.course.title || null,
      turma: String(ctx.turma.label || ctx.turma.turma_number || "") || null,
      handle,
    };

    // ── Copy (IA) ────────────────────────────────────────────────────────
    const keyword = commentKeyword(ficha.curso);
    const dias = ctx.course.duration_days;
    const diasTxt = dias ? `${dias} ${dias === 1 ? "dia" : "dias"}` : null;
    const prompt = [
      `Você é social media sênior da Smart Dent (CAD/CAM e impressão 3D odontológica).`,
      `Escreva a copy de um DEPOIMENTO em vídeo vertical, com voz HUMANA — como um post real de Instagram,`,
      `não como texto de IA. Nada de "solução inovadora", "alta qualidade", "revolucionar" ou tom institucional.`,
      ``,
      `FICHA PÚBLICA (use exatamente estes dados, não invente):`,
      `- Nome: ${ficha.nome}`,
      `- Especialidade/área: ${ficha.especialidade || "não informado"}`,
      `- Cidade/UF: ${ficha.cidade ? `${ficha.cidade}${ficha.uf ? ` (${ficha.uf})` : ""}` : "não informado"}`,
      `- Curso: ${ficha.curso || "não informado"} | Turma: ${ficha.turma || "não informado"}`,
      `- Duração do treinamento: ${diasTxt || "não informado"}`,
      `- @ do Instagram do participante: ${ficha.handle || "não cadastrado"}`,
      `- Produtos relacionados ao curso: ${ctx.course.related_product_names.join(", ") || "não informado"}`,
      `- Equipamentos citados: ${ctx.equipment.slice(0, 6).join(", ") || "não informado"}`,
      ``,
      `TRANSCRIÇÃO DO DEPOIMENTO:`,
      transcript,
      ``,
      `ESTRUTURA OBRIGATÓRIA da copy principal (siga esta ordem, com linhas em branco entre os blocos):`,
      `1) Gancho curto com 1 emoji, no estilo: "🦷 Não basta ter tecnologia. É preciso saber usá-la."`,
      `   (crie um gancho novo, coerente com o que a pessoa realmente falou)`,
      `2) "Depois de ${diasTxt ? `${diasTxt} intensos` : "dias intensos"} de treinamento no ${ficha.curso || "treinamento"}, ${ficha.nome}, ${ficha.especialidade ? ficha.especialidade.toLowerCase() : "profissional"} de ${ficha.cidade || "sua cidade"}${ficha.uf ? ` (${ficha.uf})` : ""}, encerrou a experiência na Smart Dent com uma percepção clara:"`,
      `   (escreva a duração exatamente como "${diasTxt || "dias"}", nunca "dia(s)")`,
      `3) 💬 Uma FRASE DE IMPACTO entre aspas, EXTRAÍDA LITERALMENTE da transcrição (pode aparar palavras repetidas/vícios de fala, mas não reescrever o sentido).`,
      `4) Um parágrafo curto sobre conhecimento e suporte pós-venda — a tecnologia fazendo sentido na rotina do profissional.`,
      `5) Uma linha com 3 a 4 temas práticos citados na transcrição (ex.: "Impressão 3D, caracterização e muito aprendizado na prática"), terminando com 1 emoji.`,
      `   Nesta linha use SÓ temas/etapas do treinamento — nunca marcas de equipamento de outros fabricantes.`,
      `6) "▶️ Dê o play e confira o depoimento do ${ficha.nome.split(" ")[0]}."`,
      `7) CTA: "Quer conhecer as próximas turmas do ${ficha.curso || "treinamento"}?" + nova linha + \`Saiba mais no link na Bio ou comente "${keyword}" e receba todas as informações.\``,
      ``,
      `REGRAS:`,
      `- Só afirme o que está na transcrição ou na ficha. Zero invenção.`,
      `- Frases curtas, ritmo de fala, no máximo 4 emojis no total.`,
      `- Se houver @, mencione-o (${ficha.handle || "@handle"}) na copy.`,
      `- Cite no máximo 2 produtos/equipamentos, e apenas se pertencerem ao curso (lista "Produtos relacionados") ou aparecerem na transcrição. A lista "Equipamentos citados" é o parque do participante — não atribua ao treinamento.`,
      `- Proibido: preço, valores, promessa de resultado clínico, dado privado (clínica, CNPJ, telefone).`,
      `- tiktok_caption: copy completa com a estrutura acima (até 1500 caracteres).`,
      `- story_caption: versão enxuta para Story (até 260 caracteres) — gancho + frase de impacto curta + "▶️ Dê o play" + o mesmo CTA (link na Bio / comente "${keyword}").`,
      ``,
      `Responda SOMENTE JSON: {"story_caption":"...","tiktok_caption":"...","quote":"...","hashtags":["..."]}`,
      `quote: a frase literal usada no bloco 3, sem aspas.`,
      `hashtags: 8 a 10, sem "#", em CamelCase ou minúsculas, relevantes (SmartDent, o curso, o equipamento, odontologia digital, impressão 3D, a especialidade).`,
    ].join("\n");

    const raw = await chat(
      [
        { role: "system", content: "Você escreve copies curtas, técnicas e honestas para redes sociais odontológicas B2B em português do Brasil." },
        { role: "user", content: prompt },
      ],
      { json: true },
    );
    const copy = parseJsonBlock<{ story_caption?: string; tiktok_caption?: string; quote?: string; hashtags?: string[] }>(raw);

    const ctaBlock = `Quer conhecer as próximas turmas do ${ficha.curso || "treinamento"}?\nSaiba mais no link na Bio ou comente "${keyword}" e receba todas as informações.`;
    const ensureCta = (s: string) => (s.toLowerCase().includes("link na bio") ? s : `${s.trim()}\n\n${ctaBlock}`);
    const storyCaption = ensureCta(String(copy.story_caption || "").trim());
    const tiktokCaption = ensureCta(String(copy.tiktok_caption || storyCaption).trim());
    if (!storyCaption) throw new Error("IA não retornou copy utilizável");
    const hashtags = (Array.isArray(copy.hashtags) ? copy.hashtags : [])
      .map((h) => String(h).replace(/^#/, "").replace(/\s+/g, "").trim())
      .filter(Boolean)
      .slice(0, 10);

    // ── Mídia: URL temporária somente-leitura do vídeo original no Drive ──
    const urls = await buildAccessUrls(SUPABASE_URL, String(t.turma_id), String(t.drive_file_id), "video");
    const mediaItems = [{ url: urls.original_url, type: "video" }];

    if (dryRun) {
      return jsonResponse({
        status: "dry_run", testimonial_id: t.id, ficha,
        story_caption: storyCaption, tiktok_caption: tiktokCaption, hashtags,
        media_expires_at: urls.expires_at,
      });
    }

    // ── Publicação (Story do Instagram + TikTok) ──────────────────────────
    const nowIso = new Date().toISOString();
    const { data: post, error: insErr } = await db
      .from("social_scheduled_posts")
      .insert({
        status: "scheduled",
        publish_now: true,
        scheduled_at: nowIso,
        post_type: "story",
        caption: storyCaption,
        hashtags,
        media_items: mediaItems,
        per_channel_media: { instagram: mediaItems, tiktok: mediaItems },
        channels: [
          { platform: "instagram", format: "stories" },
          { platform: "tiktok", format: "video" },
        ],
        product_name: ficha.curso,
        created_by: "training-testimonial-social-publish",
      })
      .select("id")
      .single();
    if (insErr) throw new Error(`Falha ao criar publicação: ${insErr.message}`);

    await db.from("training_testimonials").update({
      social_story_status: "queued",
      social_story_post_id: post.id,
      social_story_error: null,
      social_story_published_at: nowIso,
      social_story_attempts: Number(t.social_story_attempts || 0) + 1,
      social_story_snapshot: {
        ficha,
        story_caption: storyCaption,
        tiktok_caption: tiktokCaption,
        hashtags,
        quote: copy.quote ? String(copy.quote).trim() : null,
        comment_keyword: keyword,
        media_expires_at: urls.expires_at,
      },
    }).eq("id", t.id);

    await logEvent(db, t.id, "social_publish", "success",
      "Story do Instagram + TikTok enfileirados", { post_id: post.id, handle: ficha.handle }, actor);

    // Dispara o worker imediatamente (não bloqueia a resposta em caso de erro).
    try {
      await fetch(`${SUPABASE_URL}/functions/v1/social-publish-worker`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          apikey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
    } catch { /* o cron do worker publica na próxima rodada */ }

    return jsonResponse({
      status: "queued",
      testimonial_id: t.id,
      post_id: post.id,
      story_caption: storyCaption,
      tiktok_caption: tiktokCaption,
      hashtags,
      participant_handle: ficha.handle,
    });
  } catch (e) {
    const msg = String((e as Error).message || e);
    console.error("[training-testimonial-social-publish]", msg);
    if (testimonialId) {
      await db.from("training_testimonials")
        .update({ social_story_status: "failed", social_story_error: msg.slice(0, 1000) })
        .eq("id", testimonialId).then(() => {}, () => {});
      await logEvent(db, testimonialId, "social_publish", "error", msg.slice(0, 500)).catch(() => {});
    }
    return jsonResponse({ error: msg, testimonial_id: testimonialId }, 500);
  }
});