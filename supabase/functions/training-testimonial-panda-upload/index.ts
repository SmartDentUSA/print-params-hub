/**
 * training-testimonial-panda-upload
 *
 * Envia o vídeo do depoimento (armazenado no Google Drive) para a pasta oficial
 * "Depoimentos" do Panda Video.
 *
 * Regras invioláveis:
 *  - a pasta de destino vem SOMENTE do segredo PANDAVIDEO_TESTIMONIALS_FOLDER_ID;
 *  - a pasta é validada antes do upload; inacessível => processamento interrompido;
 *  - o folder_id é enviado à API do Panda e revalidado após a conversão;
 *  - envio duplicado pelo mesmo drive_file_id é bloqueado;
 *  - nunca há fallback para a raiz do Panda.
 *
 * Body: { testimonial_id } | { drive_file_id }  (+ force_reupload?: boolean)
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { driveDownloadStream, driveGetFileMeta, getDriveAccessToken } from "../_shared/drive.ts";
import {
  authorizeTestimonialCall, corsHeadersTestimonial, failTestimonial, jsonResponse,
  logEvent, serviceClient, setStatus,
} from "../_shared/testimonial-pipeline.ts";
import {
  assertTestimonialsFolder, buildTestimonialDescription, buildTestimonialTitle,
  getPandaVideo, uploadTestimonialVideo, waitForConversion,
} from "../_shared/pandavideo-testimonials.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeadersTestimonial });

  const auth = await authorizeTestimonialCall(req);
  if (!auth.ok) return jsonResponse({ error: auth.error }, auth.status);

  const db = serviceClient();
  let testimonialId: string | null = null;

  try {
    const body = await req.json().catch(() => ({}));
    const { testimonial_id, drive_file_id, force_reupload = false } = body ?? {};
    if (!testimonial_id && !drive_file_id) {
      return jsonResponse({ error: "testimonial_id ou drive_file_id obrigatório" }, 400);
    }

    let q = db.from("training_testimonials").select("*").limit(1);
    q = testimonial_id ? q.eq("id", testimonial_id) : q.eq("drive_file_id", drive_file_id);
    const { data: rows } = await q;
    const t = rows?.[0];
    if (!t) return jsonResponse({ error: "Depoimento não encontrado" }, 404);
    testimonialId = t.id;
    if (!t.drive_file_id) return jsonResponse({ error: "Depoimento sem arquivo no Drive" }, 409);

    // ── 1. Guarda de duplicidade (mesmo drive_file_id) ────────────────────
    if (t.pandavideo_id && !force_reupload) {
      const existing = await getPandaVideo(t.pandavideo_id);
      await logEvent(db, t.id, "panda_upload", "skipped", "Vídeo já enviado ao Panda", {
        pandavideo_id: t.pandavideo_id, folder_id: existing?.folder_id ?? t.panda_folder_id,
      }, auth.actor);
      return jsonResponse({
        status: "already_uploaded",
        testimonial_id: t.id,
        pandavideo_id: t.pandavideo_id,
        panda_folder_id: existing?.folder_id ?? t.panda_folder_id,
        conversion_status: existing?.status ?? t.video_conversion_status,
      });
    }
    const { data: sameFile } = await db
      .from("training_testimonials")
      .select("id, pandavideo_id")
      .eq("drive_file_id", t.drive_file_id)
      .not("pandavideo_id", "is", null)
      .neq("id", t.id);
    if (sameFile && sameFile.length > 0) {
      return jsonResponse({
        error: `Este arquivo do Drive já foi enviado ao Panda no depoimento ${sameFile[0].id}`,
        status: "duplicate_blocked",
      }, 409);
    }

    // ── 2. Pasta oficial: valida antes de qualquer byte ───────────────────
    const folder = await assertTestimonialsFolder();
    await db.from("training_testimonials").update({
      panda_folder_id: folder.id,
      panda_folder_verified_at: new Date().toISOString(),
      panda_last_error: null,
    }).eq("id", t.id);

    // ── 3. Metadados oficiais (turma + curso + participante) ─────────────
    const { data: turma } = await db
      .from("smartops_course_turmas")
      .select("id, turma_number, label, start_date, end_date, location, smartops_courses(title)")
      .eq("id", t.turma_id)
      .maybeSingle();
    if (!turma) throw new Error("Turma do depoimento não encontrada");
    const participantName = String(t.participant_name || "").trim();
    if (!participantName) {
      await setStatus(db, t.id, "awaiting_identification", {
        review_notes: "Participante não identificado — upload ao Panda interrompido",
      });
      return jsonResponse({ error: "Participante não identificado", status: "awaiting_identification" }, 409);
    }
    const courseTitle = (turma as any).smartops_courses?.title ?? null;
    const title = buildTestimonialTitle({
      turmaNumber: turma.turma_number ?? null, participantName, courseTitle,
    });
    const description = buildTestimonialDescription({
      participantName,
      turmaNumber: turma.turma_number ?? null,
      courseTitle,
      location: turma.location ?? null,
      startDate: turma.start_date ?? null,
      endDate: turma.end_date ?? null,
    });

    await setStatus(db, t.id, "publishing", { video_title: title, video_description: description });
    await logEvent(db, t.id, "panda_upload", "started", title, { folder_id: folder.id }, auth.actor);

    // ── 4. Bytes do Drive ────────────────────────────────────────────────
    const driveToken = await getDriveAccessToken();
    const meta = await driveGetFileMeta(driveToken, t.drive_file_id);
    const sizeBytes = Number(meta?.size || t.video_size_bytes || 0);
    if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) throw new Error("Tamanho do arquivo no Drive inválido — upload abortado");
    // Streaming evita estourar a memória da Edge Function em vídeos grandes.
    const stream = await driveDownloadStream(driveToken, t.drive_file_id);

    // ── 5. Upload com folder_id explícito ────────────────────────────────
    const videoId = crypto.randomUUID();
    await uploadTestimonialVideo({
      body: stream,
      sizeBytes,
      filename: meta?.name || t.generated_filename || `${videoId}.mp4`,
      title,
      description,
      videoId,
      folderId: folder.id,
    });

    // ── 6. Conversão + revalidação da pasta ──────────────────────────────
    const state = await waitForConversion(videoId);
    if (!state) throw new Error(`Vídeo ${videoId} não localizado no Panda após o upload`);

    const conversion = (state.status || "unknown").toUpperCase();
    if (state.folder_id && state.folder_id !== folder.id) {
      const msg = `Vídeo ${videoId} ficou na pasta ${state.folder_id} em vez da pasta oficial ${folder.id}`;
      await logEvent(db, t.id, "panda_folder_check", "error", msg, state.raw, auth.actor);
      await setStatus(db, t.id, "pending_review", {
        pandavideo_id: state.id,
        panda_folder_id: state.folder_id,
        video_conversion_status: conversion,
        video_publish_status: "pasta_incorreta",
        panda_last_error: msg,
        review_notes: msg,
      });
      return jsonResponse({ error: msg, status: "wrong_folder", pandavideo_id: state.id }, 409);
    }

    const failed = conversion === "ERROR" || conversion === "FAILED";
    const patch: Record<string, unknown> = {
      pandavideo_id: state.id,
      pandavideo_external_id: state.video_external_id,
      panda_folder_id: state.folder_id || folder.id,
      panda_folder_verified_at: new Date().toISOString(),
      video_player: state.video_player,
      video_hls: state.video_hls,
      thumbnail_url: state.thumbnail,
      video_conversion_status: conversion,
      video_provider: "pandavideo",
      video_provider_id: state.id,
      video_embed_url: state.video_player,
      video_publish_status: failed ? "conversao_falhou" : "no_panda",
      video_publish_error: failed ? `Conversão retornou ${conversion}` : null,
      panda_uploaded_at: new Date().toISOString(),
      video_published_at: failed ? null : new Date().toISOString(),
      panda_last_error: null,
    };
    if (state.length && !t.duration_seconds) patch.duration_seconds = Math.round(state.length);

    await setStatus(db, t.id, failed ? "pending_review" : (t.transcript_raw ? "transcribed" : "uploaded"), patch);
    await logEvent(db, t.id, "panda_upload", failed ? "error" : "success",
      failed ? `Conversão ${conversion}` : "Vídeo publicado na pasta oficial de Depoimentos",
      { pandavideo_id: state.id, folder_id: state.folder_id || folder.id, conversion }, auth.actor);

    return jsonResponse({
      status: failed ? "conversion_failed" : "uploaded",
      testimonial_id: t.id,
      pandavideo_id: state.id,
      pandavideo_external_id: state.video_external_id,
      panda_folder_id: state.folder_id || folder.id,
      panda_folder_name: folder.name,
      video_player: state.video_player,
      video_hls: state.video_hls,
      thumbnail_url: state.thumbnail,
      duration_seconds: state.length,
      conversion_status: conversion,
      title,
      description,
      published_at: patch.video_published_at,
    });
  } catch (e) {
    const msg = String((e as Error).message || e);
    console.error("[training-testimonial-panda-upload]", msg);
    if (testimonialId) {
      try {
        await db.from("training_testimonials")
          .update({ panda_last_error: msg.slice(0, 2000), video_publish_status: "erro" })
          .eq("id", testimonialId);
        await failTestimonial(db, testimonialId, "panda_upload", msg);
      } catch { /* erro já retornado ao chamador */ }
    }
    return jsonResponse({ error: msg, testimonial_id: testimonialId }, 500);
  }
});