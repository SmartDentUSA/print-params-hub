/**
 * training-testimonial-transcribe
 *
 * Transcreve um vídeo de depoimento já enviado ao Google Drive.
 * Entrada: { media_id } | { drive_file_id } | { testimonial_id } (+ force)
 *
 * Regras:
 *  - só processa mídia da subpasta de Depoimentos com upload concluído;
 *  - exige participante identificado (inscrição ou acompanhante) — sem isso
 *    o registro fica em `awaiting_identification` e nada é publicado;
 *  - grava transcrição literal e versão revisada separadamente;
 *  - nunca publica nada: só transcreve, analisa e registra.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { driveDownloadFile, driveGetFileMeta, getDriveAccessToken } from "../_shared/drive.ts";
import {
  authorizeTestimonialCall, chat, corsHeadersTestimonial, extensionForMime, failTestimonial,
  GATEWAY, jsonResponse, logEvent, matchParticipantByName, MAX_AUDIO_BYTES, parseJsonBlock,
  serviceClient, setStatus, sha256Hex, STT_MODEL, TESTIMONIAL_DESTINATION_KEY,
  type ParticipantCandidate,
} from "../_shared/testimonial-pipeline.ts";

const REVISION_PROMPT = `Você revisa transcrições de depoimentos de alunos de treinamentos odontológicos digitais da Smart Dent.

REGRAS ABSOLUTAS:
- Não invente nada. Não acrescente fatos, números, marcas, produtos ou opiniões que não estejam na transcrição.
- A revisão corrige apenas pontuação, ortografia, repetições de fala e vícios de linguagem ("né", "aí", gaguejos).
- Preserve integralmente o sentido, a ordem e as palavras próprias do participante.
- Se um trecho estiver incompreensível, mantenha-o e registre em low_confidence.
- Nunca incluir preço, promessa de resultado clínico ou garantia.

Responda SOMENTE JSON:
{
  "language": "pt-BR",
  "transcript_revised": "texto revisado",
  "confidence": 0.0,
  "low_confidence": ["trecho duvidoso"],
  "analysis": {
    "summary": "resumo em 1-2 frases do que o participante disse",
    "topics": ["tema"],
    "quotes": ["citação literal e contínua extraída da transcrição"],
    "sentiment": "positivo|neutro|negativo",
    "mentioned_products": ["produto citado pelo participante"],
    "usable_for_publication": true,
    "reason_if_not": null
  }
}

As "quotes" devem ser trechos contínuos copiados da transcrição literal, sem edição.`;

const NAME_PROMPT = `Você extrai APENAS o nome que a pessoa fala ao se apresentar em um depoimento.
Não invente nome. Se ninguém se apresentar com nome próprio, retorne null.
Responda SOMENTE JSON: {"spoken_name": "nome como foi falado" | null}`;

/** Inscritos e acompanhantes da turma, para casar com o nome falado. */
async function loadTurmaCandidates(db: any, turmaId: string): Promise<ParticipantCandidate[]> {
  const out: ParticipantCandidate[] = [];
  const { data: enrollments } = await db
    .from("smartops_course_enrollments")
    .select("id, nome")
    .eq("turma_id", turmaId);
  for (const e of enrollments || []) {
    if (e?.nome) out.push({ kind: "enrollment", id: e.id, name: String(e.nome) });
  }
  const ids = (enrollments || []).map((e: any) => e.id);
  if (ids.length) {
    const { data: companions } = await db
      .from("smartops_enrollment_companions")
      .select("id, nome, enrollment_id")
      .in("enrollment_id", ids);
    for (const c of companions || []) {
      if (c?.nome) out.push({ kind: "companion", id: c.id, name: String(c.nome) });
    }
  }
  return out;
}

/** Limite de corpo do gateway de STT (~26 MB). Acima disso vamos pelo Gemini Files API. */
const GATEWAY_STT_MAX_BYTES = 24 * 1024 * 1024;

/**
 * Fallback para vídeos grandes: sobe o arquivo no Gemini Files API (resumable,
 * suporta centenas de MB) e pede a transcrição literal do áudio.
 */
const GEMINI_STT_MODEL = "gemini-flash-latest";

async function transcribeViaGemini(
  body: Uint8Array | ReadableStream<Uint8Array>,
  byteLength: number,
  mime: string,
  filename: string,
): Promise<string> {
  const key = Deno.env.get("GOOGLE_AI_KEY");
  if (!key) throw new Error("GOOGLE_AI_KEY ausente para transcrição de vídeo grande");
  const base = "https://generativelanguage.googleapis.com";

  // 1) inicia upload resumable
  const start = await fetch(`${base}/upload/v1beta/files?key=${key}`, {
    method: "POST",
    headers: {
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": String(byteLength),
      "X-Goog-Upload-Header-Content-Type": mime,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ file: { display_name: filename } }),
  });
  if (!start.ok) throw new Error(`Gemini upload start ${start.status}: ${(await start.text()).slice(0, 300)}`);
  const uploadUrl = start.headers.get("x-goog-upload-url");
  if (!uploadUrl) throw new Error("Gemini upload sem x-goog-upload-url");

  // 2) envia os bytes e finaliza
  const up = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Length": String(byteLength),
      "X-Goog-Upload-Offset": "0",
      "X-Goog-Upload-Command": "upload, finalize",
    },
    body,
  });
  if (!up.ok) throw new Error(`Gemini upload ${up.status}: ${(await up.text()).slice(0, 300)}`);
  const upJson = await up.json().catch(() => null as any);
  let fileName: string = upJson?.file?.name || "";
  let fileUri: string = upJson?.file?.uri || "";
  let state: string = upJson?.file?.state || "PROCESSING";
  if (!fileName || !fileUri) throw new Error("Gemini upload sem file.uri");

  // 3) aguarda ficar ACTIVE
  for (let i = 0; i < 40 && state !== "ACTIVE"; i++) {
    if (state === "FAILED") throw new Error("Gemini falhou ao processar o vídeo");
    await new Promise((r) => setTimeout(r, 3000));
    const st = await fetch(`${base}/v1beta/${fileName}?key=${key}`);
    const stJson = await st.json().catch(() => null as any);
    state = stJson?.state || state;
    fileUri = stJson?.uri || fileUri;
  }
  if (state !== "ACTIVE") throw new Error("Gemini não concluiu o processamento do vídeo no tempo esperado");

  // 4) transcrição literal
  const gen = await fetch(`${base}/v1beta/models/${GEMINI_STT_MODEL}:generateContent?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{
        role: "user",
        parts: [
          { fileData: { mimeType: mime, fileUri } },
          {
            text: "Transcreva LITERALMENTE, em português do Brasil, tudo que é falado neste vídeo. "
              + "Não resuma, não comente, não adicione rótulos de falante nem timestamps. "
              + "Responda apenas com o texto transcrito.",
          },
        ],
      }],
      generationConfig: { temperature: 0 },
    }),
  });
  if (!gen.ok) throw new Error(`Gemini transcrição ${gen.status}: ${(await gen.text()).slice(0, 300)}`);
  const genJson = await gen.json().catch(() => null as any);
  const out = String(genJson?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text || "").join("") || "").trim();
  if (!out) throw new Error("Transcrição vazia (Gemini)");

  // limpeza best-effort do arquivo temporário
  fetch(`${base}/v1beta/${fileName}?key=${key}`, { method: "DELETE" }).catch(() => {});
  return out;
}

async function transcribeBytes(bytes: Uint8Array, filename: string): Promise<string> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) throw new Error("LOVABLE_API_KEY ausente");
  const form = new FormData();
  form.append("model", STT_MODEL);
  form.append("file", new Blob([bytes]), filename);
  const res = await fetch(`${GATEWAY}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Transcrição ${res.status}: ${text.slice(0, 500)}`);
  try {
    const parsed = JSON.parse(text);
    const out = String(parsed?.text || "").trim();
    if (!out) throw new Error("Transcrição vazia");
    return out;
  } catch (e) {
    throw new Error(`Resposta de transcrição inválida: ${String((e as Error).message)}`);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeadersTestimonial });

  const auth = await authorizeTestimonialCall(req);
  if (!auth.ok) return jsonResponse({ error: auth.error }, auth.status);

  const db = serviceClient();
  let testimonialId: string | null = null;

  try {
    const body = await req.json().catch(() => ({}));
    const { media_id, drive_file_id, testimonial_id, force = false } = body || {};
    if (!media_id && !drive_file_id && !testimonial_id) {
      return jsonResponse({ error: "Informe media_id, drive_file_id ou testimonial_id" }, 400);
    }

    // ── Registro existente ────────────────────────────────────────────────
    let existing: any = null;
    if (testimonial_id) {
      const { data } = await db.from("training_testimonials").select("*").eq("id", testimonial_id).maybeSingle();
      existing = data;
      if (!existing) return jsonResponse({ error: "Depoimento não encontrado" }, 404);
    }

    // ── Mídia de origem ───────────────────────────────────────────────────
    let media: any = null;
    const mediaQuery = db.from("training_drive_media").select("*");
    if (media_id) media = (await mediaQuery.eq("id", media_id).maybeSingle()).data;
    else if (drive_file_id) media = (await mediaQuery.eq("drive_file_id", drive_file_id).maybeSingle()).data;
    else if (existing?.media_id) media = (await mediaQuery.eq("id", existing.media_id).maybeSingle()).data;

    const fileId = media?.drive_file_id || existing?.drive_file_id || drive_file_id;
    if (!fileId) return jsonResponse({ error: "Arquivo do Drive não localizado" }, 404);

    if (media) {
      if (media.destination_key !== TESTIMONIAL_DESTINATION_KEY) {
        return jsonResponse({ error: "Mídia não é da pasta de Depoimentos" }, 422);
      }
      if (media.status !== "completed") {
        return jsonResponse({ error: `Upload ainda não concluído (status: ${media.status})` }, 409);
      }
    }

    const turmaId = media?.turma_id || existing?.turma_id;
    if (!turmaId) return jsonResponse({ error: "Turma não identificada para este depoimento" }, 422);

    const { data: turma } = await db
      .from("smartops_course_turmas")
      .select("id, course_id, turma_number, label")
      .eq("id", turmaId)
      .maybeSingle();
    if (!turma) return jsonResponse({ error: "Turma não encontrada" }, 404);

    // ── Participante confirmado ───────────────────────────────────────────
    const enrollmentId = media?.enrollment_id || existing?.enrollment_id || null;
    const companionId = media?.companion_id || existing?.companion_id || null;
    let participantName = media?.participant_name_snapshot || existing?.participant_name || null;
    let participantSnapshot: Record<string, unknown> | null = null;

    if (enrollmentId) {
      const { data: enr } = await db
        .from("smartops_course_enrollments")
        .select("id, nome, email, instagram, especialidade, area_atuacao, empresa_cidade, empresa_estado, status")
        .eq("id", enrollmentId)
        .maybeSingle();
      if (enr) {
        participantName = participantName || enr.nome;
        participantSnapshot = enr as Record<string, unknown>;
      }
    } else if (companionId) {
      const { data: comp } = await db
        .from("smartops_enrollment_companions")
        .select("*")
        .eq("id", companionId)
        .maybeSingle();
      if (comp) {
        participantName = participantName || (comp as any).nome || (comp as any).name;
        participantSnapshot = comp as Record<string, unknown>;
      }
    }

    // ── Upsert do registro ────────────────────────────────────────────────
    const baseRow = {
      turma_id: turmaId,
      course_id: turma.course_id ?? null,
      media_id: media?.id ?? existing?.media_id ?? null,
      drive_file_id: fileId,
      drive_folder_id: media?.drive_folder_id ?? existing?.drive_folder_id ?? null,
      drive_web_view_link: media?.drive_web_view_link ?? existing?.drive_web_view_link ?? null,
      generated_filename: media?.generated_filename ?? existing?.generated_filename ?? null,
      mime_type: media?.mime_type ?? existing?.mime_type ?? null,
      video_size_bytes: media?.size_bytes ?? existing?.video_size_bytes ?? null,
      enrollment_id: enrollmentId,
      companion_id: companionId,
      participant_name: participantName,
      participant_type: enrollmentId ? "enrollment" : companionId ? "companion" : null,
      participant_snapshot: participantSnapshot,
      processed_by: auth.actor,
    };

    const { data: row, error: upsertErr } = await db
      .from("training_testimonials")
      .upsert(baseRow, { onConflict: "drive_file_id" })
      .select("*")
      .single();
    if (upsertErr) throw new Error(`Falha ao registrar depoimento: ${upsertErr.message}`);
    testimonialId = row.id;

    if (row.transcript_raw && !force) {
      return jsonResponse({
        status: row.status, testimonial_id: row.id, already_transcribed: true,
      });
    }

    await setStatus(db, row.id, "transcribing", { validation_errors: [] });
    await logEvent(db, row.id, "transcription", "started", null, { drive_file_id: fileId }, auth.actor);

    // ── Download do Drive ─────────────────────────────────────────────────
    const token = await getDriveAccessToken();
    const meta = await driveGetFileMeta(token, fileId).catch(() => null);
    const mime = String(meta?.mimeType || row.mime_type || "video/mp4");
    const declaredSize = Number(meta?.size || row.video_size_bytes || 0);
    if (declaredSize && declaredSize > MAX_AUDIO_BYTES) {
      const msg = `Vídeo de ${(declaredSize / 1024 / 1024).toFixed(1)} MB excede o limite de 500 MB da transcrição. Envie uma versão compactada ou apenas o áudio.`;
      await failTestimonial(db, row.id, "transcription", msg, { size_bytes: declaredSize });
      return jsonResponse({ error: msg, testimonial_id: row.id }, 413);
    }

    const filename = `depoimento_${row.id}.${extensionForMime(mime, meta?.name)}`;

    // ── Transcrição literal ───────────────────────────────────────────────
    let raw: string;
    let hash: string | null = null;
    let processedBytes = declaredSize;

    if (declaredSize && declaredSize > GATEWAY_STT_MAX_BYTES) {
      // Vídeo grande: faz streaming Drive → Gemini, sem carregar tudo na memória
      // (bufferizar 60 MB+ estoura o limite de recursos do worker).
      const dl = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!dl.ok || !dl.body) {
        throw new Error(`Download do Drive falhou (${dl.status})`);
      }
      raw = await transcribeViaGemini(dl.body, declaredSize, mime, filename);
    } else {
      const bytes = await driveDownloadFile(token, fileId);
      processedBytes = bytes.byteLength;
      hash = await sha256Hex(bytes);
      try {
        raw = await transcribeBytes(bytes, filename);
      } catch (e) {
        const m = String((e as Error).message || "");
        if (/\b413\b|too large|entity_too_large/i.test(m)) {
          raw = await transcribeViaGemini(bytes, bytes.byteLength, mime, filename);
        } else throw e;
      }
    }

    // ── Identificação pela fala (quando ninguém foi vinculado no upload) ──
    let resolvedEnrollmentId = enrollmentId;
    let resolvedCompanionId = companionId;
    if (!resolvedEnrollmentId && !resolvedCompanionId) {
      let spoken: string | null = null;
      try {
        const nameRaw = await chat([
          { role: "system", content: NAME_PROMPT },
          { role: "user", content: raw.slice(0, 4000) },
        ], { json: true });
        spoken = parseJsonBlock<any>(nameRaw)?.spoken_name || null;
      } catch (e) {
        await logEvent(db, row.id, "identification", "error", String((e as Error).message));
      }

      const candidates = await loadTurmaCandidates(db, turmaId);
      const match = spoken ? matchParticipantByName(spoken, candidates) : null;
      if (match) {
        if (match.kind === "enrollment") resolvedEnrollmentId = match.id;
        else resolvedCompanionId = match.id;
        participantName = match.name;
        if (match.kind === "enrollment") {
          const { data: enr } = await db
            .from("smartops_course_enrollments")
            .select("id, nome, email, instagram, especialidade, area_atuacao, empresa_cidade, empresa_estado, status")
            .eq("id", match.id)
            .maybeSingle();
          if (enr) participantSnapshot = enr as Record<string, unknown>;
        }
        await db.from("training_testimonials").update({
          enrollment_id: resolvedEnrollmentId,
          companion_id: resolvedCompanionId,
          participant_name: participantName,
          participant_type: resolvedEnrollmentId ? "enrollment" : "companion",
          participant_snapshot: participantSnapshot,
        }).eq("id", row.id);
        await logEvent(db, row.id, "identification", "success", `Participante identificado pela fala: ${participantName}`, { spoken });
      } else {
        await setStatus(db, row.id, "awaiting_identification", {
          transcript_raw: raw,
          transcription_model: STT_MODEL,
          transcribed_at: new Date().toISOString(),
          review_notes: spoken
            ? `Nome falado "${spoken}" não casou com nenhum inscrito da turma — selecione o participante.`
            : "Participante não identificado na fala — selecione manualmente.",
          auto_process: false,
        });
        await logEvent(db, row.id, "identification", "blocked", "Participante não identificado", { spoken });
        return jsonResponse({ status: "awaiting_identification", testimonial_id: row.id, spoken_name: spoken }, 409);
      }
    }

    // ── Revisão + análise (sem inventar nada) ─────────────────────────────
    const revisionRaw = await chat([
      { role: "system", content: REVISION_PROMPT },
      {
        role: "user",
        content: `Participante: ${participantName || "não informado"}\nTurma: ${turma.label || turma.turma_number || turma.id}\n\nTRANSCRIÇÃO LITERAL:\n${raw}`,
      },
    ], { json: true });
    const revision = parseJsonBlock<any>(revisionRaw);

    const durationSeconds = Number(meta?.videoMediaMetadata?.durationMillis || 0) / 1000 || null;

    await setStatus(db, row.id, "transcribed", {
      video_sha256: hash,
      video_size_bytes: processedBytes || null,
      mime_type: mime,
      duration_seconds: durationSeconds,
      language: revision?.language || "pt-BR",
      transcript_raw: raw,
      transcript_revised: String(revision?.transcript_revised || "").trim() || raw,
      transcription_confidence: Number(revision?.confidence ?? 0) || null,
      low_confidence_segments: Array.isArray(revision?.low_confidence) ? revision.low_confidence : [],
      transcription_model: hash ? STT_MODEL : GEMINI_STT_MODEL,
      transcribed_at: new Date().toISOString(),
      analysis: revision?.analysis ?? null,
      version: (row.version || 1) + (row.transcript_raw ? 1 : 0),
    });
    await logEvent(db, row.id, "transcription", "success", "Transcrição concluída", {
      chars: raw.length,
      confidence: revision?.confidence ?? null,
      usable: revision?.analysis?.usable_for_publication ?? null,
    }, auth.actor);

    return jsonResponse({
      status: "transcribed",
      testimonial_id: row.id,
      participant_name: participantName,
      language: revision?.language || "pt-BR",
      confidence: revision?.confidence ?? null,
      usable_for_publication: revision?.analysis?.usable_for_publication ?? null,
      transcript_chars: raw.length,
    });
  } catch (e) {
    const msg = String((e as Error).message || e);
    console.error("[training-testimonial-transcribe]", msg);
    if (testimonialId) await failTestimonial(db, testimonialId, "transcription", msg).catch(() => {});
    return jsonResponse({ error: msg, testimonial_id: testimonialId }, 500);
  }
});