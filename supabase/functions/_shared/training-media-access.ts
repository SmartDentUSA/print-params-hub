// Acesso seguro e temporário às mídias reais de um treinamento.
//
// Regras críticas:
// - Isolamento absoluto entre turmas: um drive_file_id só é liberado se estiver
//   comprovadamente dentro da estrutura oficial daquela turma.
// - Nenhum segredo (service_role, tokens Google, chaves de conector) é devolvido.
// - Somente leitura: o token assinado não autoriza escrita, mover ou excluir.
// - Duração do treinamento é sempre dinâmica (nunca 3 dias fixos).

import { driveGetAccessMeta } from "./drive.ts";

const ACCESS_SECRET = Deno.env.get("MARKETING_MEDIA_ACCESS_SECRET") || "";
const TTL_SECONDS = 3600;

export type MediaVariant = "original" | "preview" | "thumbnail";

export interface AccessTokenPayload {
  t: string; // turma_id
  f: string; // drive_file_id
  v: MediaVariant;
  e: number; // expira (epoch segundos)
}

/* ------------------------- dias dinâmicos ------------------------- */

export interface TrainingDay {
  day_number: number;
  date: string | null;
  start_time: string | null;
  end_time: string | null;
  topic: string | null;
}

export interface TrainingSchedule {
  days: TrainingDay[];
  total_training_days: number;
  last_training_day: number;
  current_training_day: number | null;
  schedule_source: "turma_days" | "date_range" | "course_duration" | "unknown";
  inconsistency: string | null;
}

function isoDate(v: unknown): string | null {
  return v ? String(v).slice(0, 10) : null;
}

/** Resolve a programação REAL da turma. Nunca assume 3 dias. */
export async function resolveTrainingSchedule(db: any, turma: any): Promise<TrainingSchedule> {
  let days: TrainingDay[] = [];
  let source: TrainingSchedule["schedule_source"] = "unknown";

  try {
    const { data } = await db
      .from("smartops_turma_days")
      .select("day_number, date, start_time, end_time, topic")
      .eq("turma_id", turma.id)
      .order("day_number", { ascending: true });
    days = (data || [])
      .filter((d: any) => Number(d.day_number) >= 1)
      .map((d: any) => ({
        day_number: Number(d.day_number),
        date: isoDate(d.date),
        start_time: d.start_time ?? null,
        end_time: d.end_time ?? null,
        topic: d.topic ?? null,
      }));
    if (days.length) source = "turma_days";
  } catch { /* tabela ausente não pode quebrar a leitura */ }

  const start = isoDate(turma?.start_date);
  const end = isoDate(turma?.end_date) || start;
  const courseDuration = Number(turma?.smartops_courses?.duration_days || 0) || null;

  if (!days.length && start && end) {
    const s = new Date(`${start}T00:00:00Z`).getTime();
    const e = new Date(`${end}T00:00:00Z`).getTime();
    const span = Math.max(1, Math.round((e - s) / 86400000) + 1);
    days = Array.from({ length: span }, (_, i) => ({
      day_number: i + 1,
      date: new Date(s + i * 86400000).toISOString().slice(0, 10),
      start_time: null,
      end_time: null,
      topic: null,
    }));
    source = "date_range";
  }

  if (!days.length && courseDuration) {
    days = Array.from({ length: courseDuration }, (_, i) => ({
      day_number: i + 1,
      date: null,
      start_time: null,
      end_time: null,
      topic: null,
    }));
    source = "course_duration";
  }

  const total = days.length;
  const last = total ? Math.max(...days.map((d) => d.day_number)) : 0;

  const today = new Date().toISOString().slice(0, 10);
  let current: number | null = null;
  for (const d of days) if (d.date && d.date <= today) current = Math.max(current ?? 0, d.day_number);
  if (current == null && days.some((d) => d.date && d.date > today)) current = 0;

  let inconsistency: string | null = null;
  if (courseDuration && total && courseDuration !== total) {
    inconsistency =
      `training_schedule_inconsistency: curso informa ${courseDuration} dia(s) mas a turma tem ${total} dia(s) cadastrado(s). ` +
      "A programação da turma prevalece; corrigir cadastro.";
  }

  return {
    days,
    total_training_days: total,
    last_training_day: last,
    current_training_day: current,
    schedule_source: source,
    inconsistency,
  };
}

/** Um day_number só é válido se existir na programação real da turma. */
export function isValidTrainingDay(schedule: TrainingSchedule, dayNumber: number): boolean {
  return schedule.days.some((d) => d.day_number === Number(dayNumber));
}

/* ------------------------- token assinado ------------------------- */

function b64urlEncode(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(input: string): Uint8Array {
  const pad = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = pad + "=".repeat((4 - (pad.length % 4)) % 4);
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

async function hmac(data: string): Promise<string> {
  if (!ACCESS_SECRET) throw new Error("MARKETING_MEDIA_ACCESS_SECRET não configurado");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(ACCESS_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data)));
  return b64urlEncode(sig);
}

export async function signMediaToken(payload: AccessTokenPayload): Promise<string> {
  const body = b64urlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  return `${body}.${await hmac(body)}`;
}

export async function verifyMediaToken(token: string): Promise<AccessTokenPayload | null> {
  const [body, sig] = String(token || "").split(".");
  if (!body || !sig) return null;
  const expected = await hmac(body);
  if (expected.length !== sig.length) return null;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  if (diff !== 0) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(body))) as AccessTokenPayload;
    if (!payload?.t || !payload?.f || !payload?.e) return null;
    if (payload.e * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

/* --------------------- autorização por turma --------------------- */

export interface AuthorizedMedia {
  media_id: string | null;
  drive_file_id: string;
  filename: string;
  mime_type: string | null;
  size_bytes: number | null;
  width: number | null;
  height: number | null;
  orientation: "vertical" | "horizontal" | "square" | null;
  duration_seconds: number | null;
  kind: "photo" | "video" | "other";
  destination_key: string | null;
  day_number: number | null;
  participant_id: string | null;
  participant_name: string | null;
  registered_in_db: boolean;
}

export type AccessError =
  | "MEDIA_NOT_FOUND"
  | "MEDIA_NOT_IN_TRAINING"
  | "TRAINING_DRIVE_NOT_CONFIGURED";

function orientationOf(w: number | null, h: number | null): AuthorizedMedia["orientation"] {
  if (!w || !h) return null;
  if (h > w) return "vertical";
  if (w > h) return "horizontal";
  return "square";
}

function kindOf(mime: string | null): AuthorizedMedia["kind"] {
  if (!mime) return "other";
  if (mime.startsWith("image/")) return "photo";
  if (mime.startsWith("video/")) return "video";
  return "other";
}

function dayFromFilename(name: string): number | null {
  const m = String(name || "").match(/_DIA-(\d+)[_.]/i);
  return m ? Number(m[1]) : null;
}

/**
 * Autoriza um drive_file_id para a turma informada.
 * Primeiro tenta o registro oficial no banco; se o arquivo foi enviado
 * manualmente ao Drive, valida os `parents` contra a estrutura oficial.
 */
export async function authorizeMedia(
  db: any,
  turma: any,
  driveFileId: string,
): Promise<{ ok: true; media: AuthorizedMedia } | { ok: false; error: AccessError; message: string }> {
  const officialFolders = new Set<string>(
    Object.values((turma?.drive_subfolders || {}) as Record<string, string>).filter(Boolean) as string[],
  );
  if (turma?.drive_folder_id) officialFolders.add(String(turma.drive_folder_id));
  if (!officialFolders.size) {
    return {
      ok: false,
      error: "TRAINING_DRIVE_NOT_CONFIGURED",
      message: "A turma não possui estrutura oficial do Google Drive vinculada.",
    };
  }

  // Registro oficial no Sistema B (fonte de verdade preferencial).
  const { data: row } = await db
    .from("training_drive_media")
    .select(
      "id, turma_id, destination_key, drive_file_id, generated_filename, original_filename, mime_type, size_bytes, width, height, orientation, training_day, enrollment_id, companion_id, participant_name_snapshot",
    )
    .eq("drive_file_id", driveFileId)
    .maybeSingle();

  if (row && String(row.turma_id) !== String(turma.id)) {
    return {
      ok: false,
      error: "MEDIA_NOT_IN_TRAINING",
      message: "O arquivo solicitado não pertence à turma informada.",
    };
  }

  const meta = await driveGetAccessMeta(driveFileId);
  if (!meta || meta.trashed) {
    if (!row) {
      return { ok: false, error: "MEDIA_NOT_FOUND", message: "Arquivo não encontrado no Google Drive." };
    }
  }

  // Sem registro no banco: só libera se estiver fisicamente dentro da estrutura da turma.
  if (!row) {
    const inside = (meta?.parents || []).some((p) => officialFolders.has(p));
    if (!inside) {
      return {
        ok: false,
        error: "MEDIA_NOT_IN_TRAINING",
        message: "O arquivo solicitado não pertence à turma informada.",
      };
    }
  }

  const filename = row?.generated_filename || meta?.name || "";
  const mime = row?.mime_type || meta?.mimeType || null;
  const width = meta?.width ?? row?.width ?? null;
  const height = meta?.height ?? row?.height ?? null;

  return {
    ok: true,
    media: {
      media_id: row?.id ?? null,
      drive_file_id: driveFileId,
      filename,
      mime_type: mime,
      size_bytes: meta?.size ?? row?.size_bytes ?? null,
      width,
      height,
      orientation: (row?.orientation as any) || orientationOf(width, height),
      duration_seconds: meta?.durationMillis != null ? Math.round(meta.durationMillis / 1000) : null,
      kind: kindOf(mime),
      destination_key: row?.destination_key ?? null,
      day_number: row?.training_day ?? dayFromFilename(filename),
      participant_id: row?.companion_id || row?.enrollment_id || null,
      participant_name: row?.participant_name_snapshot ?? null,
      registered_in_db: !!row,
    },
  };
}

/** Elegibilidade por plataforma calculada pela orientação real (não pela pasta). */
export function eligibleFor(media: AuthorizedMedia): string[] {
  const out: string[] = [];
  if (media.kind === "video") {
    if (media.orientation === "vertical") out.push("instagram_reels", "instagram_stories", "youtube_shorts", "tiktok");
    else out.push("instagram_feed_video", "facebook", "linkedin", "youtube");
  } else if (media.kind === "photo") {
    if (media.orientation === "vertical") out.push("instagram_feed", "instagram_carousel", "instagram_stories");
    else out.push("instagram_feed", "instagram_carousel", "facebook", "linkedin");
  }
  return out;
}

/** Monta as URLs temporárias somente-leitura do proxy autenticado. */
export async function buildAccessUrls(
  supabaseUrl: string,
  turmaId: string,
  driveFileId: string,
  kind: AuthorizedMedia["kind"],
): Promise<{ original_url: string; preview_url: string | null; thumbnail_url: string | null; expires_at: string; ttl_seconds: number }> {
  const exp = Math.floor(Date.now() / 1000) + TTL_SECONDS;
  const base = `${supabaseUrl}/functions/v1/training-media-proxy?t=`;
  const mk = async (v: MediaVariant) => `${base}${encodeURIComponent(await signMediaToken({ t: turmaId, f: driveFileId, v, e: exp }))}`;
  return {
    original_url: await mk("original"),
    preview_url: kind === "other" ? null : await mk("preview"),
    thumbnail_url: kind === "other" ? null : await mk("thumbnail"),
    expires_at: new Date(exp * 1000).toISOString(),
    ttl_seconds: TTL_SECONDS,
  };
}
