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

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  m4v: "video/x-m4v",
};

/** Mobile pickers sometimes return an empty or generic MIME type. */
export function resolvedMimeType(file: File): string {
  const reported = String(file.type || "").toLowerCase();
  if (reported && reported !== "application/octet-stream") return reported;
  const extension = file.name.split(".").pop()?.toLowerCase() || "";
  return MIME_BY_EXTENSION[extension] || reported;
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
  // A função exige um JWT de usuário válido: sem sessão, nem tentamos chamar.
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    throw new Error("Faça login novamente para enviar mídias de treinamento");
  }
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
  const retryableStatuses = new Set([408, 429, 500, 502, 503, 504]);
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
      if (!retryableStatuses.has(resp.status) || attempt === 3) throw new Error(lastMessage);
    } catch (error) {
      if (signal?.aborted) throw new Error("Upload cancelado");
      lastMessage = error instanceof Error ? error.message : String(error);
      if (attempt === 3 || (!lastMessage.includes("fetch") && !lastMessage.includes("503") && !lastMessage.includes("502") && !lastMessage.includes("504"))) {
        throw error;
      }
    }

    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(resolve, 1000 * 2 ** attempt);
      signal?.addEventListener("abort", () => {
        window.clearTimeout(timeout);
        reject(new Error("Upload cancelado"));
      }, { once: true });
    });
  }

  throw new Error(lastMessage);
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
    let settled = false;
    let timeoutId: number | undefined;
    const done = (w: number | null, h: number | null) => {
      if (settled) return;
      settled = true;
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      URL.revokeObjectURL(url);
      resolve({ width: w, height: h });
    };
    // iOS/Android may never emit loadedmetadata for a local high-resolution
    // video. Dimensions are optional, so never block the actual upload.
    timeoutId = window.setTimeout(() => done(null, null), 5000);
    const mimeType = resolvedMimeType(file);
    if (mimeType.startsWith("image/")) {
      const img = new Image();
      img.onload = () => done(img.naturalWidth, img.naturalHeight);
      img.onerror = () => done(null, null);
      img.src = url;
    } else if (mimeType.startsWith("video/")) {
      const v = document.createElement("video");
      v.preload = "metadata";
      v.muted = true;
      v.playsInline = true;
      v.onloadedmetadata = () => done(v.videoWidth || null, v.videoHeight || null);
      v.onerror = () => done(null, null);
      v.src = url;
      v.load();
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
  // Smaller requests are more resilient on mobile connections while staying
  // aligned to Google Drive's required 256 KiB chunk multiple.
  const chunkSize = Math.min(prepared.chunk_size || 4 * 1024 * 1024, 4 * 1024 * 1024);
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
