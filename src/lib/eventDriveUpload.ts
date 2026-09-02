import { supabase } from "@/integrations/supabase/client";
import { readDimensions, resolvedMimeType } from "@/lib/trainingDriveUpload";

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/event-drive-media-upload`;

export { readDimensions, resolvedMimeType };

export interface EventDestination {
  key: string;
  label: string;
  token: string;
  kind: "photo" | "video" | "both";
  day?: number | null;
  date?: string | null;
  speaker?: string | null;
  purpose: string;
  group: string;
}

export interface EventPreparePayload {
  event_id: string;
  destination_key: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  width?: number | null;
  height?: number | null;
}

export interface EventPrepareResult {
  upload_id: string;
  generated_filename: string;
  chunk_size: number;
  destination_label: string;
  event_day: number | null;
  event_date: string | null;
  speaker_name: string | null;
}

async function authHeaders(): Promise<HeadersInit> {
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Faça login novamente para enviar mídias do evento");
  return { Authorization: `Bearer ${token}`, apikey: anonKey };
}

export async function prepareEventUpload(payload: EventPreparePayload): Promise<EventPrepareResult> {
  const resp = await fetch(`${FN_URL}?action=prepare`, {
    method: "POST",
    headers: { ...(await authHeaders()), "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(json?.error || `Falha ao preparar upload (${resp.status})`);
  return json as EventPrepareResult;
}

interface ChunkResponse {
  done: boolean;
  received: number;
  drive_file_id?: string;
  drive_web_view_link?: string;
}

async function sendChunk(uploadId: string, chunk: Blob, start: number, signal?: AbortSignal): Promise<ChunkResponse> {
  const retryable = new Set([408, 429, 500, 502, 503, 504]);
  let lastMessage = "Falha temporária no envio";
  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (signal?.aborted) throw new Error("Upload cancelado");
    try {
      const resp = await fetch(`${FN_URL}?action=chunk`, {
        method: "POST",
        headers: {
          ...(await authHeaders()),
          "Content-Type": "application/octet-stream",
          "x-upload-id": uploadId,
          "x-chunk-start": String(start),
        },
        body: chunk,
        signal,
      });
      const json = await resp.json().catch(() => ({}));
      if (resp.ok) return json as ChunkResponse;
      lastMessage = json?.error || `Falha no envio do bloco (${resp.status})`;
      if (!retryable.has(resp.status) || attempt === 3) throw new Error(lastMessage);
    } catch (error) {
      if (signal?.aborted) throw new Error("Upload cancelado");
      lastMessage = error instanceof Error ? error.message : String(error);
      if (attempt === 3) throw error;
    }
    await new Promise((resolve) => window.setTimeout(resolve, 1000 * 2 ** attempt));
  }
  throw new Error(lastMessage);
}

export async function runEventUpload(
  file: File,
  prepared: EventPrepareResult,
  onProgress: (sent: number, total: number) => void,
  signal?: AbortSignal,
): Promise<{ drive_web_view_link?: string }> {
  const chunkSize = Math.min(prepared.chunk_size || 4 * 1024 * 1024, 4 * 1024 * 1024);
  let offset = 0;
  while (offset < file.size) {
    if (signal?.aborted) throw new Error("Upload cancelado");
    const slice = file.slice(offset, Math.min(offset + chunkSize, file.size));
    const res = await sendChunk(prepared.upload_id, slice, offset, signal);
    if (res.done) {
      onProgress(file.size, file.size);
      return { drive_web_view_link: res.drive_web_view_link };
    }
    offset = res.received ?? offset + slice.size;
    onProgress(offset, file.size);
  }
  throw new Error("Drive não confirmou a conclusão do arquivo");
}

export async function cancelEventUpload(uploadId: string): Promise<void> {
  await fetch(`${FN_URL}?action=cancel`, {
    method: "POST",
    headers: { ...(await authHeaders()), "Content-Type": "application/json" },
    body: JSON.stringify({ upload_id: uploadId }),
  }).catch(() => {});
}

export interface EventDriveInventory {
  counts: Record<string, number>;
  names: Record<string, string[]>;
}

export async function fetchEventDriveInventory(eventId: string): Promise<EventDriveInventory> {
  const resp = await fetch(`${FN_URL}?action=inventory&event_id=${encodeURIComponent(eventId)}`, {
    method: "POST",
    headers: { ...(await authHeaders()), "Content-Type": "application/json" },
    body: JSON.stringify({ event_id: eventId }),
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(json?.error || `Falha ao ler o Drive (${resp.status})`);
  return { counts: json?.counts || {}, names: json?.names || {} };
}

export function acceptFor(kind: EventDestination["kind"]): string {
  if (kind === "photo") return "image/*";
  if (kind === "video") return "video/*";
  return "image/*,video/*";
}
