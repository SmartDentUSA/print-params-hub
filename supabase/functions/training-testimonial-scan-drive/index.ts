/**
 * training-testimonial-scan-drive
 *
 * Varre a pasta "04 - Vídeos Originais → 03 - Depoimentos" do Drive da turma e
 * enfileira no pipeline (training_testimonials) todo vídeo que ainda não está
 * registrado — cobre os arquivos enviados direto pelo Drive, fora do app.
 *
 * Body: { turma_id?: string, turma_number?: number, dry_run?: boolean }
 * Sem turma: varre todas as turmas encerradas nos últimos 7 dias.
 *
 * Idempotente: drive_file_id é único; reenvio não duplica.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getDriveAccessToken, driveListFiles } from "../_shared/drive.ts";
import {
  authorizeTestimonialCall, corsHeadersTestimonial, jsonResponse, safeEqualSecret, serviceClient,
} from "../_shared/testimonial-pipeline.ts";

const VIDEO_MIME = /^video\//i;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeadersTestimonial });

  // Chave dedicada do cron/operação interna, ou as credenciais normais do pipeline.
  const cronKey = (Deno.env.get("TESTIMONIAL_CRON_KEY") || "").trim();
  const headerCron = (req.headers.get("x-cron-key") || "").trim();
  const isCron = Boolean(cronKey && headerCron && safeEqualSecret(headerCron, cronKey));
  if (!isCron) {
    const auth = await authorizeTestimonialCall(req);
    if (!auth.ok) return jsonResponse({ error: auth.error }, auth.status);
  }

  try {
    const body = await req.json().catch(() => ({} as any));
    const dryRun = body?.dry_run === true;
    const db = serviceClient();

    // Diagnóstico: lista o conteúdo bruto de uma pasta do Drive.
    if (body?.list_folder_id) {
      const t = await getDriveAccessToken();
      const items = await driveListFiles(t, String(body.list_folder_id));
      return jsonResponse({ success: true, folder_id: body.list_folder_id, items });
    }

    let query = db
      .from("smartops_course_turmas")
      .select("id, turma_number, course_id, drive_subfolders, start_date, end_date");
    if (body?.turma_id) query = query.eq("id", String(body.turma_id));
    else if (body?.turma_number) query = query.eq("turma_number", Number(body.turma_number));
    else query = query.gte("end_date", new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10));

    const { data: turmas, error } = await query;
    if (error) throw new Error(`turmas: ${error.message}`);
    if (!turmas?.length) return jsonResponse({ error: "Turma não encontrada" }, 404);

    const token = await getDriveAccessToken();
    const results: any[] = [];

    for (const turma of turmas) {
      const folderId = (turma.drive_subfolders || {})["videos_depoimentos"];
      if (!folderId) {
        results.push({ turma_number: turma.turma_number, error: "pasta Depoimentos não provisionada" });
        continue;
      }

      const files = (await driveListFiles(token, folderId)).filter((f) => VIDEO_MIME.test(f.mimeType));
      const ids = files.map((f) => f.id);
      const { data: existing } = ids.length
        ? await db.from("training_testimonials").select("drive_file_id").in("drive_file_id", ids)
        : { data: [] as any[] };
      const known = new Set((existing || []).map((r: any) => r.drive_file_id));
      const novos = files.filter((f) => !known.has(f.id));

      if (!dryRun && novos.length) {
        // Casa com a mídia já registrada quando o upload veio pelo app.
        const { data: medias } = await db
          .from("training_drive_media")
          .select("id, drive_file_id, enrollment_id, companion_id, participant_name_snapshot, generated_filename")
          .eq("turma_id", turma.id)
          .eq("destination_key", "videos_depoimentos");
        const byFile = new Map((medias || []).map((m: any) => [m.drive_file_id, m]));

        const rows = novos.map((f) => {
          const m: any = byFile.get(f.id) || {};
          const hasParticipant = Boolean(m.enrollment_id || m.companion_id);
          return {
            turma_id: turma.id,
            course_id: turma.course_id ?? null,
            media_id: m.id ?? null,
            drive_file_id: f.id,
            drive_folder_id: folderId,
            drive_web_view_link: f.webViewLink ?? null,
            generated_filename: m.generated_filename ?? f.name,
            mime_type: f.mimeType,
            video_size_bytes: f.size ?? null,
            enrollment_id: m.enrollment_id ?? null,
            companion_id: m.companion_id ?? null,
            participant_name: m.participant_name_snapshot ?? null,
            participant_type: m.enrollment_id ? "enrollment" : m.companion_id ? "companion" : null,
            status: hasParticipant ? "uploaded" : "awaiting_identification",
            auto_process: true,
            auto_attempts: 0,
            auto_next_attempt_at: new Date().toISOString(),
            auto_last_error: null,
          };
        });
        const { error: insErr } = await db
          .from("training_testimonials")
          .upsert(rows, { onConflict: "drive_file_id", ignoreDuplicates: true });
        if (insErr) throw new Error(`insert: ${insErr.message}`);
      }

      results.push({
        turma_id: turma.id,
        turma_number: turma.turma_number,
        drive_folder_id: folderId,
        videos_na_pasta: files.length,
        ja_registrados: known.size,
        enfileirados: dryRun ? 0 : novos.length,
        novos_arquivos: novos.map((f) => f.name),
      });
    }

    return jsonResponse({ success: true, dry_run: dryRun, results });
  } catch (e) {
    console.error("[training-testimonial-scan-drive]", e);
    return jsonResponse({ error: (e as Error).message || "erro interno" }, 500);
  }
});