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
  GATEWAY, jsonResponse, logEvent, MAX_AUDIO_BYTES, parseJsonBlock, serviceClient, setStatus,
  sha256Hex, STT_MODEL, TESTIMONIAL_DESTINATION_KEY,
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

    if (!enrollmentId && !companionId) {
      await setStatus(db, row.id, "awaiting_identification", {
        review_notes: "Participante não vinculado à turma — identifique antes de transcrever.",
      });
      await logEvent(db, row.id, "identification", "blocked", "Participante não identificado");
      return jsonResponse({ status: "awaiting_identification", testimonial_id: row.id }, 409);
    }

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

    const bytes = await driveDownloadFile(token, fileId);
    if (bytes.byteLength > MAX_AUDIO_BYTES) {
      const msg = `Arquivo baixado tem ${(bytes.byteLength / 1024 / 1024).toFixed(1)} MB e excede o limite de 500 MB da transcrição.`;
      await failTestimonial(db, row.id, "transcription", msg);
      return jsonResponse({ error: msg, testimonial_id: row.id }, 413);
    }

    const hash = await sha256Hex(bytes);
    const filename = `depoimento_${row.id}.${extensionForMime(mime, meta?.name)}`;

    // ── Transcrição literal ───────────────────────────────────────────────
    const raw = await transcribeBytes(bytes, filename);

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
      video_size_bytes: bytes.byteLength,
      mime_type: mime,
      duration_seconds: durationSeconds,
      language: revision?.language || "pt-BR",
      transcript_raw: raw,
      transcript_revised: String(revision?.transcript_revised || "").trim() || raw,
      transcription_confidence: Number(revision?.confidence ?? 0) || null,
      low_confidence_segments: Array.isArray(revision?.low_confidence) ? revision.low_confidence : [],
      transcription_model: STT_MODEL,
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