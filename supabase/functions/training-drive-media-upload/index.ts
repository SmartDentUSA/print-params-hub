// Upload de mídias de treinamento DIRETO para o Google Drive.
// Nenhum byte trafega/permanece no Supabase Storage — apenas metadados em
// public.training_drive_media. O upload é resumível e feito em chunks
// proxiados por esta função (credenciais nunca vão para o navegador).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  getDriveAccessToken,
  driveListNames,
  driveStartResumableUpload,
  driveUploadChunk,
  driveCancelResumable,
  driveGetWebViewLink,
} from "../_shared/drive.ts";
import {
  DESTINATIONS,
  MIME_EXT,
  kindOfMime,
  buildGeneratedFilename,
} from "./naming.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-upload-id, x-chunk-start",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const CHUNK_SIZE = 8 * 1024 * 1024; // múltiplo de 256KB
const MAX_SIZE = 5 * 1024 * 1024 * 1024;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const admin = () => createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

// Mesma rota de autenticação da criação de pasta do Drive
// (training-create-drive-folder): a função roda com verify_jwt = false e usa
// service role. O usuário é resolvido apenas de forma opcional, para
// registrar quem enviou a mídia — nunca para bloquear o envio.
async function authorize(req: Request) {
  const authHeader = req.headers.get("Authorization") || "";
  const db = admin();
  let user: any = null;
  if (authHeader.startsWith("Bearer ")) {
    try {
      const userClient = createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false },
      });
      const { data } = await userClient.auth.getUser();
      user = data?.user ?? null;
    } catch (_e) {
      user = null;
    }
  }
  return { user, db };
}

async function loadTurma(db: any, turmaId: string) {
  const { data, error } = await db
    .from("smartops_course_turmas")
    .select("id, turma_number, label, course_id, start_date, end_date, drive_folder_id, drive_folder_url, drive_subfolders, smartops_courses(title)")
    .eq("id", turmaId)
    .maybeSingle();
  if (error) throw new Error(`turma: ${error.message}`);
  return data;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const action = (url.searchParams.get("action") || "").toLowerCase();
    const { user, db } = await authorize(req);

    /* ----------------------------- CHUNK ----------------------------- */
    if (action === "chunk") {
      const uploadId = req.headers.get("x-upload-id") || url.searchParams.get("upload_id") || "";
      const start = Number(req.headers.get("x-chunk-start") || url.searchParams.get("start") || "0");
      if (!uploadId) return json({ error: "upload_id obrigatório" }, 400);

      const { data: row, error } = await db
        .from("training_drive_media")
        .select("id, uploaded_by, size_bytes, resumable_session_uri, status, bytes_uploaded, drive_file_id")
        .eq("id", uploadId)
        .maybeSingle();
      if (error) return json({ error: error.message }, 500);
      if (!row) return json({ error: "Upload não encontrado" }, 404);
      if (row.status === "completed") {
        return json({ done: true, received: row.size_bytes, drive_file_id: row.drive_file_id });
      }
      if (!row.resumable_session_uri) return json({ error: "Sessão de upload indisponível" }, 409);

      const bytes = new Uint8Array(await req.arrayBuffer());
      if (!bytes.byteLength) return json({ error: "Chunk vazio" }, 400);
      if (bytes.byteLength > CHUNK_SIZE + 1024) return json({ error: "Chunk maior que o permitido" }, 413);
      if (start + bytes.byteLength > Number(row.size_bytes)) return json({ error: "Chunk fora do tamanho declarado" }, 400);

      try {
        const res = await driveUploadChunk(row.resumable_session_uri, bytes, start, Number(row.size_bytes));
        if (res.done) {
          const link = res.webViewLink || (res.fileId ? await driveGetWebViewLink("gateway", res.fileId) : null);
          await db.from("training_drive_media").update({
            status: "completed",
            bytes_uploaded: Number(row.size_bytes),
            drive_file_id: res.fileId ?? null,
            drive_web_view_link: link,
            uploaded_at: new Date().toISOString(),
            error_message: null,
          }).eq("id", uploadId);
          return json({ done: true, received: Number(row.size_bytes), drive_file_id: res.fileId, drive_web_view_link: link });
        }
        await db.from("training_drive_media").update({ status: "uploading", bytes_uploaded: res.received }).eq("id", uploadId);
        return json({ done: false, received: res.received });
      } catch (e: any) {
        await db.from("training_drive_media").update({ status: "error", error_message: String(e?.message || e).slice(0, 500) }).eq("id", uploadId);
        return json({ error: e?.message || String(e) }, 502);
      }
    }

    /* ----------------------------- STATUS ---------------------------- */
    if (action === "status") {
      const uploadId = url.searchParams.get("upload_id") || "";
      const { data, error } = await db
        .from("training_drive_media")
        .select("id, status, bytes_uploaded, size_bytes, generated_filename, drive_file_id, drive_web_view_link, error_message, uploaded_by")
        .eq("id", uploadId)
        .maybeSingle();
      if (error) return json({ error: error.message }, 500);
      if (!data) return json({ error: "Upload não encontrado" }, 404);
      return json(data);
    }

    /* ----------------------------- CANCEL ---------------------------- */
    if (action === "cancel") {
      const body = await req.json().catch(() => ({}));
      const uploadId = body?.upload_id || url.searchParams.get("upload_id");
      const { data: row } = await db
        .from("training_drive_media")
        .select("id, uploaded_by, resumable_session_uri, status")
        .eq("id", uploadId)
        .maybeSingle();
      if (!row) return json({ error: "Upload não encontrado" }, 404);
      if (row.status === "completed") return json({ error: "Upload já concluído" }, 409);
      if (row.resumable_session_uri) await driveCancelResumable(row.resumable_session_uri);
      await db.from("training_drive_media").update({ status: "canceled", resumable_session_uri: null }).eq("id", row.id);
      return json({ ok: true });
    }

    /* ---------------------------- PREPARE ---------------------------- */
    if (action !== "prepare") return json({ error: "action inválida (prepare|chunk|status|cancel)" }, 400);

    const body = await req.json().catch(() => ({}));
    const turmaId = String(body?.turma_id || "");
    const destinationKey = String(body?.destination_key || "");
    const mimeType = String(body?.mime_type || "");
    const sizeBytes = Number(body?.size_bytes || 0);
    const originalFilename = String(body?.original_filename || "arquivo");

    if (!turmaId) return json({ error: "turma_id obrigatório" }, 400);
    const dest = DESTINATIONS[destinationKey];
    if (!dest) return json({ error: `destination_key inválida: ${destinationKey}` }, 400);
    if (!MIME_EXT[mimeType]) return json({ error: `Tipo de arquivo não permitido: ${mimeType || "desconhecido"}` }, 415);
    const kind = kindOfMime(mimeType);
    if (kind !== dest.kind) {
      return json({ error: `Arquivo ${kind === "photo" ? "de imagem" : "de vídeo"} não pode ir para este destino` }, 400);
    }
    if (!Number.isFinite(sizeBytes) || sizeBytes <= 0 || sizeBytes > MAX_SIZE) {
      return json({ error: "Tamanho de arquivo inválido" }, 400);
    }

    const turma = await loadTurma(db, turmaId);
    if (!turma) return json({ error: "Turma não encontrada" }, 404);
    const subfolders = (turma.drive_subfolders || {}) as Record<string, string>;
    if (!turma.drive_folder_id || !Object.keys(subfolders).length) {
      return json({ error: "Pasta do Drive ainda não criada para esta turma" }, 409);
    }
    const folderId = subfolders[destinationKey];
    if (!folderId) return json({ error: `Subpasta ${destinationKey} não existe no Drive desta turma` }, 409);

    // ---- dia / data
    let trainingDay: number | null = null;
    let trainingDate: string | null = null;
    if (dest.requiresDay) {
      const rawDay = body?.training_day;
      const isGeral = rawDay === "geral" || rawDay === null || rawDay === "" || rawDay === undefined;
      if (isGeral && body?.day_choice !== "geral" && rawDay !== "geral") {
        return json({ error: "Classificação de dia obrigatória (Dia 1/2/3 ou Geral)" }, 400);
      }
      if (!isGeral) {
        const dayNum = Number(rawDay);
        const { data: days } = await db
          .from("smartops_turma_days")
          .select("day_number, date")
          .eq("turma_id", turmaId)
          .order("day_number");
        const match = (days || []).find((d: any) => Number(d.day_number) === dayNum);
        if (match) {
          trainingDay = dayNum;
          trainingDate = match.date;
        } else if (dayNum === 1 && turma.start_date) {
          trainingDay = 1;
          trainingDate = turma.start_date;
        } else {
          return json({ error: `Dia ${rawDay} não existe nesta turma` }, 400);
        }
      }
    }

    // ---- participante (depoimentos)
    let enrollmentId: string | null = null;
    let companionId: string | null = null;
    let participantName: string | null = null;
    let participantType: string | null = null;
    let exceptionReason: string | null = null;

    if (dest.testimonial) {
      enrollmentId = body?.enrollment_id ? String(body.enrollment_id) : null;
      companionId = body?.companion_id ? String(body.companion_id) : null;
      exceptionReason = body?.exception_reason ? String(body.exception_reason).slice(0, 300) : null;

      if (companionId) {
        const { data: comp } = await db
          .from("smartops_enrollment_companions")
          .select("id, name, enrollment_id, smartops_course_enrollments!inner(id, turma_id)")
          .eq("id", companionId)
          .maybeSingle();
        if (!comp || (comp as any).smartops_course_enrollments?.turma_id !== turmaId) {
          return json({ error: "Acompanhante não pertence a esta turma" }, 400);
        }
        participantName = (comp as any).name;
        participantType = "acompanhante";
        enrollmentId = (comp as any).enrollment_id;
      } else if (enrollmentId) {
        const { data: enr } = await db
          .from("smartops_course_enrollments")
          .select("id, person_name, turma_id")
          .eq("id", enrollmentId)
          .maybeSingle();
        if (!enr || enr.turma_id !== turmaId) {
          return json({ error: "Inscrição não pertence a esta turma" }, 400);
        }
        participantName = enr.person_name;
        participantType = "principal";
      } else {
        if (!exceptionReason || exceptionReason.length < 5) {
          return json({ error: "Depoimento exige participante da turma ou justificativa de exceção" }, 400);
        }
        participantName = "Participante não localizado";
        participantType = "excecao";
      }
    }

    const courseTitle = (turma as any).smartops_courses?.title || turma.label || "Treinamento";
    const token = await getDriveAccessToken();

    const nameParts = {
      turmaNumber: turma.turma_number ?? "SN",
      courseTitle,
      destination: dest,
      trainingDate,
      trainingDay,
      participantName,
      mimeType,
    };

    // sequência: nomes já existentes na pasta + registros já em andamento no banco
    const existingDrive = await driveListNames(token, folderId);
    const { data: existingRows } = await db
      .from("training_drive_media")
      .select("generated_filename")
      .eq("turma_id", turmaId)
      .eq("destination_key", destinationKey)
      .in("status", ["pending", "uploading", "completed"]);
    const existing = [...existingDrive, ...(existingRows || []).map((r: any) => r.generated_filename)];

    const { filename } = buildGeneratedFilename(nameParts as any, existing);

    const sessionUri = await driveStartResumableUpload(token, folderId, filename, mimeType, sizeBytes);

    const width = Number.isFinite(Number(body?.width)) ? Number(body.width) : null;
    const height = Number.isFinite(Number(body?.height)) ? Number(body.height) : null;
    const orientation = width && height ? (width >= height ? "landscape" : "portrait") : null;

    const { data: inserted, error: insErr } = await db
      .from("training_drive_media")
      .insert({
        turma_id: turmaId,
        enrollment_id: enrollmentId,
        companion_id: companionId,
        participant_name_snapshot: participantName,
        participant_type: participantType,
        destination_key: destinationKey,
        drive_folder_id: folderId,
        original_filename: originalFilename.slice(0, 300),
        generated_filename: filename,
        mime_type: mimeType,
        size_bytes: sizeBytes,
        width,
        height,
        orientation,
        training_day: trainingDay,
        training_date: trainingDate,
        category: dest.token,
        status: "pending",
        resumable_session_uri: sessionUri,
        exception_reason: exceptionReason,
        uploaded_by: user?.id ?? null,
      })
      .select("id")
      .single();
    if (insErr) {
      await driveCancelResumable(sessionUri);
      return json({ error: `Falha ao registrar upload: ${insErr.message}` }, 500);
    }

    console.log(JSON.stringify({
      event: "training_media_prepared",
      turma_id: turmaId,
      destination_key: destinationKey,
      folder_id: folderId,
      generated_filename: filename,
      size_bytes: sizeBytes,
    }));

    return json({
      upload_id: inserted.id,
      generated_filename: filename,
      chunk_size: CHUNK_SIZE,
      destination_label: dest.label,
      participant_name: participantName,
      training_day: trainingDay,
      training_date: trainingDate,
    });
  } catch (err: any) {
    console.error("[training-drive-media-upload]", err);
    return json({ error: err?.message || String(err) }, 500);
  }
});
