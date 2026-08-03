import { supabase } from "@/integrations/supabase/client";

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/training-drive-media-upload`;

export interface PreparePayload {
  turma_id: string;
  destination_key: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  width?: number | null;
  height?: number | null;
  training_day?: number | "geral" | null;
  enrollment_id?: string | null;
  companion_id?: string | null;
  exception_reason?: string | null;
}

export interface PrepareResult {
  upload_id: string;
  generated_filename: string;
  chunk_size: number;
  destination_label: string;
  participant_name: string | null;
  training_day: number | null;
  training_date: string | null;
}

async function authHeaders(): Promise<HeadersInit> {
  // Mesma rota da criação de pasta do Drive: a função aceita a chave
  // publicável; o token do usuário vai junto apenas quando existe, para
  // registrar quem enviou a mídia.
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token || anonKey;
  return {
    Authorization: `Bearer ${token}`,
    apikey: anonKey,
  };
}

export async function prepareUpload(payload: PreparePayload): Promise<PrepareResult> {
  const resp = await fetch(`${FN_URL}?action=prepare`, {
    method: "POST",
    headers: { ...(await authHeaders()), "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(json?.error || `Falha ao preparar upload (${resp.status})`);
  return json as PrepareResult;
}

export interface ChunkResponse {
  done: boolean;
  received: number;
  drive_file_id?: string;
  drive_web_view_link?: string;
}

export async function sendChunk(
  uploadId: string,
  chunk: Blob,
  start: number,
  signal?: AbortSignal,
): Promise<ChunkResponse> {
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
  if (!resp.ok) throw new Error(json?.error || `Falha no envio do bloco (${resp.status})`);
  return json as ChunkResponse;
}

export async function cancelUpload(uploadId: string): Promise<void> {
  await fetch(`${FN_URL}?action=cancel`, {
    method: "POST",
    headers: { ...(await authHeaders()), "Content-Type": "application/json" },
    body: JSON.stringify({ upload_id: uploadId }),
  }).catch(() => {});
}

/** Reads intrinsic dimensions (best effort, metadata only). */
export function readDimensions(file: File): Promise<{ width: number | null; height: number | null }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const done = (w: number | null, h: number | null) => {
      URL.revokeObjectURL(url);
      resolve({ width: w, height: h });
    };
    if (file.type.startsWith("image/")) {
      const img = new Image();
      img.onload = () => done(img.naturalWidth, img.naturalHeight);
      img.onerror = () => done(null, null);
      img.src = url;
    } else if (file.type.startsWith("video/")) {
      const v = document.createElement("video");
      v.preload = "metadata";
      v.onloadedmetadata = () => done(v.videoWidth || null, v.videoHeight || null);
      v.onerror = () => done(null, null);
      v.src = url;
    } else {
      done(null, null);
    }
  });
}

export interface UploadProgress {
  (sent: number, total: number): void;
}

/** Runs the resumable upload chunk by chunk. Returns the Drive file link. */
export async function runUpload(
  file: File,
  prepared: PrepareResult,
  onProgress: UploadProgress,
  signal?: AbortSignal,
): Promise<{ drive_file_id?: string; drive_web_view_link?: string }> {
  const chunkSize = prepared.chunk_size || 8 * 1024 * 1024;
  let offset = 0;
  while (offset < file.size) {
    if (signal?.aborted) throw new Error("Upload cancelado");
    const slice = file.slice(offset, Math.min(offset + chunkSize, file.size));
    const res = await sendChunk(prepared.upload_id, slice, offset, signal);
    if (res.done) {
      onProgress(file.size, file.size);
      return { drive_file_id: res.drive_file_id, drive_web_view_link: res.drive_web_view_link };
    }
    offset = res.received ?? offset + slice.size;
    onProgress(offset, file.size);
  }
  throw new Error("Drive não confirmou a conclusão do arquivo");
}

export interface DriveInventory {
  counts: Record<string, number>;
  names: Record<string, string[]>;
}

/** Conta arquivos já existentes nas subpastas do Drive (inclui uploads manuais). */
export async function fetchDriveInventory(turmaId: string): Promise<DriveInventory> {
  const resp = await fetch(`${FN_URL}?action=inventory&turma_id=${encodeURIComponent(turmaId)}`, {
    method: "POST",
    headers: { ...(await authHeaders()), "Content-Type": "application/json" },
    body: JSON.stringify({ turma_id: turmaId }),
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(json?.error || `Falha ao ler o Drive (${resp.status})`);
  return { counts: json?.counts || {}, names: json?.names || {} };
}
