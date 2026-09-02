// Upload de mídias de EVENTOS direto para o Google Drive (resumível, em chunks).
// Nenhum byte fica no Supabase Storage: só metadados em public.event_drive_media.
// O nome final do arquivo é decidido aqui — o navegador nunca o define.
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
  acceptsKind,
  buildEventFilename,
  kindOfMime,
  MIME_EXT,
  type EventDestination,
} from "../_shared/event-drive-spec.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-upload-id, x-chunk-start",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const CHUNK_SIZE = 4 * 1024 * 1024;
const MAX_SIZE = 5 * 1024 * 1024 * 1024;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const admin = () => createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

type AuthResult =
  | { ok: true; user: { id: string }; isAdmin: boolean; db: any }
  | { ok: false; status: number; error: string };

async function authorize(req: Request): Promise<AuthResult> {
  const header = req.headers.get("Authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token || token === ANON_KEY) return { ok: false, status: 401, error: "Autenticação obrigatória" };

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data, error } = await userClient.auth.getUser();
  const user = data?.user ?? null;
  if (error || !user) return { ok: false, status: 401, error: "Sessão inválida ou expirada" };

  const { data: allowed, error: permErr } = await userClient.rpc("can_manage_training_media", {
    _user_id: user.id,
  });
  if (permErr) return { ok: false, status: 403, error: `Falha ao validar permissão: ${permErr.message}` };
  if (allowed !== true) return { ok: false, status: 403, error: "Usuário sem permissão para enviar mídias" };

  const db = admin();
  const { data: adminRole } = await db
    .from("user_roles")
    .select("user_id")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();
  return { ok: true, user: { id: user.id }, isAdmin: !!adminRole, db };
}

async function loadEvent(db: any, eventId: string) {
  const { data, error } = await db
    .from("smartops_events")
    .select("id, name, location, country, company_stand, start_date, end_date, days_count, speakers, drive_folder_id, drive_folder_url, drive_subfolders, drive_destinations")
    .eq("id", eventId)
    .maybeSingle();
  if (error) throw new Error(`evento: ${error.message}`);
  return data;
}

/** Dispara a geração de copy sem bloquear o upload. */
async function triggerCopy(mediaId: string) {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/event-media-copy`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_ROLE}`,
        apikey: SERVICE_ROLE,
      },
      body: JSON.stringify({ media_id: mediaId }),
    });
    if (!res.ok) console.warn(`[event-media-copy] ${res.status}: ${(await res.text()).slice(0, 300)}`);
  } catch (e) {
    console.warn("[event-media-copy] trigger falhou", String((e as any)?.message || e));
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const action = (url.searchParams.get("action") || "").toLowerCase();
    const auth = await authorize(req);
    if (!auth.ok) return json({ error: auth.error }, auth.status);
    const { user, isAdmin, db } = auth;
    const ownsRow = (row: any) => isAdmin || row?.uploaded_by === user.id;

    /* ------------------------------ CHUNK ------------------------------ */
    if (action === "chunk") {
      const uploadId = req.headers.get("x-upload-id") || url.searchParams.get("upload_id") || "";
      const start = Number(req.headers.get("x-chunk-start") || url.searchParams.get("start") || "0");
      if (!uploadId) return json({ error: "upload_id obrigatório" }, 400);

      const { data: row, error } = await db
        .from("event_drive_media")
        .select("id, uploaded_by, size_bytes, resumable_session_uri, status, drive_file_id")
        .eq("id", uploadId)
        .maybeSingle();
      if (error) return json({ error: error.message }, 500);
      if (!row) return json({ error: "Upload não encontrado" }, 404);
      if (!ownsRow(row)) return json({ error: "Upload pertence a outro usuário" }, 403);
      if (row.status === "completed") {
        return json({ done: true, received: row.size_bytes, drive_file_id: row.drive_file_id });
      }
      if (!row.resumable_session_uri) return json({ error: "Sessão de upload indisponível" }, 409);

      const bytes = new Uint8Array(await req.arrayBuffer());
      if (!bytes.byteLength) return json({ error: "Chunk vazio" }, 400);
      if (bytes.byteLength > CHUNK_SIZE + 1024) return json({ error: "Chunk maior que o permitido" }, 413);
      if (start + bytes.byteLength > Number(row.size_bytes)) {
        return json({ error: "Chunk fora do tamanho declarado" }, 400);
      }

      try {
        const res = await driveUploadChunk(row.resumable_session_uri, bytes, start, Number(row.size_bytes));
        if (res.done) {
          const link = res.webViewLink || (res.fileId ? await driveGetWebViewLink("gateway", res.fileId) : null);
          await db.from("event_drive_media").update({
            status: "completed",
            bytes_uploaded: Number(row.size_bytes),
            drive_file_id: res.fileId ?? null,
            drive_web_view_link: link,
            uploaded_at: new Date().toISOString(),
            error_message: null,
          }).eq("id", uploadId);
          // Copy contextual (não bloqueia a resposta do upload).
          triggerCopy(uploadId);
          return json({ done: true, received: Number(row.size_bytes), drive_file_id: res.fileId, drive_web_view_link: link });
        }
        await db.from("event_drive_media").update({ status: "uploading", bytes_uploaded: res.received }).eq("id", uploadId);
        return json({ done: false, received: res.received });
      } catch (e: any) {
        await db.from("event_drive_media")
          .update({ status: "uploading", error_message: String(e?.message || e).slice(0, 500) })
          .eq("id", uploadId);
        return json({ error: e?.message || String(e) }, 502);
      }
    }

    /* ---------------------------- INVENTORY ---------------------------- */
    if (action === "inventory") {
      const eventId = url.searchParams.get("event_id") || (await req.json().catch(() => ({})))?.event_id;
      if (!eventId) return json({ error: "event_id obrigatório" }, 400);
      const ev = await loadEvent(db, String(eventId));
      if (!ev) return json({ error: "Evento não encontrado" }, 404);
      const subfolders = (ev.drive_subfolders || {}) as Record<string, string>;
      const keys = Object.keys(subfolders);
      if (!keys.length) return json({ counts: {}, names: {} });
      const token = await getDriveAccessToken();
      const counts: Record<string, number> = {};
      const names: Record<string, string[]> = {};
      await Promise.all(keys.map(async (k) => {
        try {
          const list = await driveListNames(token, subfolders[k]);
          names[k] = list;
          counts[k] = list.length;
        } catch (e) {
          console.error("[event-inventory]", k, String((e as any)?.message || e));
          names[k] = [];
          counts[k] = 0;
        }
      }));
      return json({ counts, names });
    }

    /* ------------------------------ STATUS ----------------------------- */
    if (action === "status") {
      const uploadId = url.searchParams.get("upload_id") || "";
      const { data, error } = await db
        .from("event_drive_media")
        .select("id, status, bytes_uploaded, size_bytes, generated_filename, drive_file_id, drive_web_view_link, error_message, uploaded_by, copy_status, copy_caption")
        .eq("id", uploadId)
        .maybeSingle();
      if (error) return json({ error: error.message }, 500);
      if (!data) return json({ error: "Upload não encontrado" }, 404);
      if (!ownsRow(data)) return json({ error: "Upload pertence a outro usuário" }, 403);
      return json(data);
    }

    /* ------------------------------ CANCEL ----------------------------- */
    if (action === "cancel") {
      const body = await req.json().catch(() => ({}));
      const uploadId = body?.upload_id || url.searchParams.get("upload_id");
      const { data: row } = await db
        .from("event_drive_media")
        .select("id, uploaded_by, resumable_session_uri, status")
        .eq("id", uploadId)
        .maybeSingle();
      if (!row) return json({ error: "Upload não encontrado" }, 404);
      if (!ownsRow(row)) return json({ error: "Upload pertence a outro usuário" }, 403);
      if (row.status === "completed") return json({ error: "Upload já concluído" }, 409);
      if (row.resumable_session_uri) await driveCancelResumable(row.resumable_session_uri);
      await db.from("event_drive_media").update({ status: "cancelled", resumable_session_uri: null }).eq("id", row.id);
      return json({ ok: true });
    }

    /* ----------------------------- PREPARE ----------------------------- */
    if (action !== "prepare") return json({ error: "action inválida (prepare|chunk|status|cancel|inventory)" }, 400);

    const body = await req.json().catch(() => ({}));
    const eventId = String(body?.event_id || "");
    const destinationKey = String(body?.destination_key || "");
    const mimeType = String(body?.mime_type || "");
    const sizeBytes = Number(body?.size_bytes || 0);
    const originalFilename = String(body?.original_filename || "arquivo");

    if (!eventId) return json({ error: "event_id obrigatório" }, 400);
    if (!MIME_EXT[mimeType]) return json({ error: `Tipo de arquivo não permitido: ${mimeType || "desconhecido"}` }, 415);
    if (!Number.isFinite(sizeBytes) || sizeBytes <= 0 || sizeBytes > MAX_SIZE) {
      return json({ error: "Tamanho de arquivo inválido" }, 400);
    }

    const ev = await loadEvent(db, eventId);
    if (!ev) return json({ error: "Evento não encontrado" }, 404);
    const subfolders = (ev.drive_subfolders || {}) as Record<string, string>;
    const destinations = (ev.drive_destinations || []) as EventDestination[];
    if (!ev.drive_folder_id || !destinations.length) {
      return json({ error: "Pasta do Drive ainda não criada para este evento" }, 409);
    }
    const dest = destinations.find((d) => d.key === destinationKey);
    if (!dest) return json({ error: `destination_key inválida: ${destinationKey}` }, 400);
    const folderId = subfolders[destinationKey];
    if (!folderId) return json({ error: `Subpasta ${destinationKey} não existe no Drive deste evento` }, 409);

    const kind = kindOfMime(mimeType)!;
    if (!acceptsKind(dest, kind)) {
      return json({ error: `Esta pasta aceita apenas ${dest.kind === "photo" ? "fotos" : "vídeos"}` }, 400);
    }

    const token = await getDriveAccessToken();
    const existingDrive = await driveListNames(token, folderId);
    const { data: existingRows } = await db
      .from("event_drive_media")
      .select("generated_filename")
      .eq("event_id", eventId)
      .eq("destination_key", destinationKey)
      .in("status", ["pending", "uploading", "completed"]);
    const existing = [...existingDrive, ...(existingRows || []).map((r: any) => r.generated_filename)];

    const filename = buildEventFilename({ eventName: ev.name, destination: dest, mimeType }, existing);
    const sessionUri = await driveStartResumableUpload(token, folderId, filename, mimeType, sizeBytes);

    const width = Number.isFinite(Number(body?.width)) ? Number(body.width) : null;
    const height = Number.isFinite(Number(body?.height)) ? Number(body.height) : null;
    const orientation = width && height
      ? (width === height ? "quadrado" : width > height ? "horizontal" : "vertical")
      : null;

    const { data: inserted, error: insErr } = await db
      .from("event_drive_media")
      .insert({
        event_id: eventId,
        destination_key: destinationKey,
        destination_label: dest.label,
        category: dest.group,
        event_day: dest.day ?? null,
        event_date: dest.date ?? null,
        speaker_name: dest.speaker ?? null,
        drive_folder_id: folderId,
        original_filename: originalFilename.slice(0, 300),
        generated_filename: filename,
        mime_type: mimeType,
        size_bytes: sizeBytes,
        width,
        height,
        orientation,
        status: "pending",
        resumable_session_uri: sessionUri,
        uploaded_by: user.id,
      })
      .select("id")
      .single();
    if (insErr) {
      await driveCancelResumable(sessionUri).catch(() => {});
      return json({ error: `Falha ao registrar upload: ${insErr.message}` }, 500);
    }

    return json({
      upload_id: inserted.id,
      generated_filename: filename,
      chunk_size: CHUNK_SIZE,
      destination_label: dest.label,
      event_day: dest.day ?? null,
      event_date: dest.date ?? null,
      speaker_name: dest.speaker ?? null,
    });
  } catch (err: any) {
    console.error("[event-drive-media-upload]", err);
    return json({ error: err?.message || String(err) }, 500);
  }
});
