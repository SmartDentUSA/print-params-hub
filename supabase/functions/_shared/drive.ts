// Shared Google Drive helpers used by training-create-drive-folder,
// smartops-gerar-doc-turma, generate-certificate, etc.
//
// Auth: Lovable Connector Gateway (OAuth user token — oraculosmartdent@gmail.com).
// Service accounts don't have storage quota in a personal Gmail Drive, so we
// route every call through the connector so files land under the OAuth user
// quota and folder capabilities.

const GATEWAY_BASE = "https://connector-gateway.lovable.dev/google_drive";
const DRIVE_PATH = "/drive/v3";
const UPLOAD_PATH = "/upload/drive/v3";

function gwHeaders(): HeadersInit {
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  const connKey = Deno.env.get("GOOGLE_DRIVE_API_KEY");
  if (!lovableKey || !connKey) {
    throw new Error("Missing LOVABLE_API_KEY or GOOGLE_DRIVE_API_KEY (Google Drive connector not linked)");
  }
  return {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": connKey,
  };
}

/**
 * Kept for backwards compatibility with callers that pass a `token` argument.
 * The gateway supplies its own auth, so the returned string is only a marker.
 */
export async function getDriveAccessToken(): Promise<string> {
  // Validate env upfront so callers fail fast with a clear error.
  gwHeaders();
  return "gateway";
}

async function driveFetch(_token: string, path: string, init: RequestInit = {}, isUpload = false): Promise<any> {
  const base = isUpload ? `${GATEWAY_BASE}${UPLOAD_PATH}` : `${GATEWAY_BASE}${DRIVE_PATH}`;
  const resp = await fetch(`${base}${path}`, {
    ...init,
    headers: { ...gwHeaders(), ...(init.headers || {}) },
  });
  if (!resp.ok) throw new Error(`Drive ${path} ${resp.status}: ${await resp.text()}`);
  return resp.json();
}

export async function driveCreateFolder(token: string, name: string, parentId: string): Promise<string> {
  const data = await driveFetch(token, "/files?fields=id&supportsAllDrives=true", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    }),
  });
  return data.id as string;
}

export async function driveFindChild(token: string, parentId: string, name: string, folder = false): Promise<string | null> {
  const safe = name.replace(/'/g, "\\'");
  const mime = folder ? " and mimeType='application/vnd.google-apps.folder'" : "";
  const q = encodeURIComponent(`'${parentId}' in parents and name='${safe}'${mime} and trashed=false`);
  const data = await driveFetch(token, `/files?q=${q}&fields=files(id,name)&supportsAllDrives=true&includeItemsFromAllDrives=true`);
  return data.files?.[0]?.id ?? null;
}

/** Get-or-create a subfolder by exact name. */
export async function driveEnsureFolder(token: string, parentId: string, name: string): Promise<string> {
  const existing = await driveFindChild(token, parentId, name, true);
  if (existing) return existing;
  return await driveCreateFolder(token, name, parentId);
}

export interface UploadOpts {
  token: string;
  folderId: string;
  name: string;
  content: Uint8Array | string;
  mimeType: string;
  existingFileId?: string | null;
  /** If true, look up existing file by name inside folderId when existingFileId not given. */
  overwriteByName?: boolean;
}

/** Upload (or replace) a file via multipart. Returns the file id. */
export async function driveUploadFile(opts: UploadOpts): Promise<string> {
  const { folderId, name, content, mimeType } = opts;
  let existingId = opts.existingFileId || null;
  if (!existingId && opts.overwriteByName) {
    existingId = await driveFindChild(opts.token, folderId, name, false);
  }

  const boundary = `bdry_${crypto.randomUUID()}`;
  const metadata = existingId ? { name } : { name, parents: [folderId], mimeType };

  const encoder = new TextEncoder();
  const bodyBytes = typeof content === "string" ? encoder.encode(content) : content;

  const preamble = encoder.encode(
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: ${mimeType}\r\n` +
    `Content-Transfer-Encoding: binary\r\n\r\n`,
  );
  const closing = encoder.encode(`\r\n--${boundary}--`);

  const body = new Uint8Array(preamble.length + bodyBytes.length + closing.length);
  body.set(preamble, 0);
  body.set(bodyBytes, preamble.length);
  body.set(closing, preamble.length + bodyBytes.length);

  const path = existingId
    ? `/files/${existingId}?uploadType=multipart&fields=id&supportsAllDrives=true`
    : `/files?uploadType=multipart&fields=id&supportsAllDrives=true`;

  const resp = await fetch(`${GATEWAY_BASE}${UPLOAD_PATH}${path}`, {
    method: existingId ? "PATCH" : "POST",
    headers: {
      ...gwHeaders(),
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body,
  });
  if (!resp.ok) throw new Error(`Drive upload ${resp.status}: ${await resp.text()}`);
  const data = await resp.json();
  return data.id as string;
}

/** Slug for filenames: strip diacritics, keep letters/numbers, use underscores. No PII. */
export async function driveGetFileMeta(token: string, fileId: string): Promise<any> {
  return await driveFetch(
    token,
    `/files/${fileId}?fields=id,name,mimeType,size,parents,webViewLink,videoMediaMetadata&supportsAllDrives=true`,
  );
}

/** Download raw bytes of a Drive file (alt=media) through the connector gateway. */
export async function driveDownloadFile(_token: string, fileId: string): Promise<Uint8Array> {
  const resp = await fetch(
    `${GATEWAY_BASE}${DRIVE_PATH}/files/${fileId}?alt=media&supportsAllDrives=true`,
    { headers: gwHeaders() },
  );
  if (!resp.ok) throw new Error(`Drive download ${resp.status}: ${await resp.text()}`);
  return new Uint8Array(await resp.arrayBuffer());
}

/** Manda o arquivo para a lixeira do Drive (mais seguro que delete definitivo). */
export async function driveTrashFile(token: string, fileId: string): Promise<void> {
  await driveFetch(token, `/files/${fileId}?supportsAllDrives=true&fields=id,trashed`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ trashed: true }),
  });
}

export function slugForFilename(input: string): string {
  return String(input || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80) || "sem_nome";
}

/** Remove characters unsafe for a Drive folder name but preserve accents. */
export function sanitizeFolderName(name: string): string {
  return String(name || "")
    .replace(/[\/\\]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

/* ------------------------------------------------------------------ */
/* Resumable upload helpers (used by training-drive-media-upload)      */
/* ------------------------------------------------------------------ */

/** List file names inside a folder, optionally filtered by name prefix. */
export async function driveListNames(
  token: string,
  folderId: string,
  namePrefix?: string,
): Promise<string[]> {
  const clauses = [`'${folderId}' in parents`, "trashed=false"];
  if (namePrefix) clauses.push(`name contains '${namePrefix.replace(/'/g, "\\'")}'`);
  const q = encodeURIComponent(clauses.join(" and "));
  const data = await driveFetch(
    token,
    `/files?q=${q}&fields=files(id,name)&pageSize=1000&supportsAllDrives=true&includeItemsFromAllDrives=true`,
  );
  return (data.files || []).map((f: any) => String(f.name || ""));
}

/**
 * Start a resumable upload session. Returns the session URI already rewritten
 * to the connector gateway when possible, so chunk PUTs stay authenticated
 * server-side (credentials never leave the edge function).
 */
export async function driveStartResumableUpload(
  _token: string,
  folderId: string,
  name: string,
  mimeType: string,
  sizeBytes: number,
): Promise<string> {
  const resp = await fetch(
    `${GATEWAY_BASE}${UPLOAD_PATH}/files?uploadType=resumable&supportsAllDrives=true&fields=id,name,webViewLink`,
    {
      method: "POST",
      headers: {
        ...gwHeaders(),
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": mimeType,
        "X-Upload-Content-Length": String(sizeBytes),
      },
      body: JSON.stringify({ name, parents: [folderId], mimeType }),
    },
  );
  if (!resp.ok) {
    throw new Error(`Drive resumable init ${resp.status}: ${await resp.text()}`);
  }
  await resp.body?.cancel().catch(() => {});
  const location = resp.headers.get("location") || resp.headers.get("Location");
  if (!location) throw new Error("Drive resumable init: sem header Location");
  return location;
}

/** Candidate URLs for a session URI: gateway-proxied first, then direct. */
function resumableCandidates(sessionUri: string): string[] {
  const out: string[] = [];
  const m = sessionUri.match(/^https:\/\/[^/]*googleapis\.com(\/upload\/drive\/v3\/.*)$/);
  if (m) out.push(`${GATEWAY_BASE}${m[1]}`);
  out.push(sessionUri);
  return out;
}

export interface ChunkResult {
  done: boolean;
  /** Bytes confirmed by Drive so far (next expected offset). */
  received: number;
  fileId?: string;
  webViewLink?: string;
}

/** Upload one chunk to an open resumable session. */
export async function driveUploadChunk(
  sessionUri: string,
  chunk: Uint8Array,
  start: number,
  totalSize: number,
): Promise<ChunkResult> {
  const end = start + chunk.byteLength - 1;
  let lastErr = "";
  for (const url of resumableCandidates(sessionUri)) {
    const isGateway = url.startsWith(GATEWAY_BASE);
    const resp = await fetch(url, {
      method: "PUT",
      headers: {
        ...(isGateway ? gwHeaders() : {}),
        "Content-Range": `bytes ${start}-${end}/${totalSize}`,
        "Content-Length": String(chunk.byteLength),
      },
      body: chunk,
    });
    if (resp.status === 308) {
      const range = resp.headers.get("range");
      await resp.body?.cancel().catch(() => {});
      const received = range ? Number(range.split("-")[1]) + 1 : end + 1;
      return { done: false, received };
    }
    if (resp.ok) {
      const text = await resp.text();
      let json: any = {};
      try { json = JSON.parse(text); } catch { /* ignore */ }
      return {
        done: true,
        received: totalSize,
        fileId: json?.id,
        webViewLink: json?.webViewLink || (json?.id ? `https://drive.google.com/file/d/${json.id}/view` : undefined),
      };
    }
    lastErr = `${resp.status}: ${await resp.text()}`;
    // Auth/route problems on the gateway path → try the direct session URI.
    if (![401, 403, 404, 405].includes(resp.status)) break;
  }
  throw new Error(`Drive chunk upload falhou ${lastErr}`);
}

/** Abort a resumable session (best effort). */
export async function driveCancelResumable(sessionUri: string): Promise<void> {
  for (const url of resumableCandidates(sessionUri)) {
    try {
      const resp = await fetch(url, {
        method: "DELETE",
        headers: url.startsWith(GATEWAY_BASE) ? gwHeaders() : {},
      });
      await resp.body?.cancel().catch(() => {});
      if (resp.ok || resp.status === 499) return;
    } catch { /* ignore */ }
  }
}

/** Fetch a file's webViewLink. */
export async function driveGetWebViewLink(token: string, fileId: string): Promise<string | null> {
  try {
    const data = await driveFetch(token, `/files/${fileId}?fields=id,webViewLink&supportsAllDrives=true`);
    return data?.webViewLink ?? `https://drive.google.com/file/d/${fileId}/view`;
  } catch {
    return `https://drive.google.com/file/d/${fileId}/view`;
  }
}
/* ------------------------------------------------------------------ */
/* Read-only detailed listing (used by smartops-marketing-agent-api)   */
/* ------------------------------------------------------------------ */

export interface DriveFileDetail {
  id: string;
  name: string;
  mimeType: string | null;
  size: number | null;
  createdTime: string | null;
  width: number | null;
  height: number | null;
}

/** List files inside a folder with metadata (size, mime, dimensions). */
export async function driveListFilesDetailed(
  token: string,
  folderId: string,
): Promise<DriveFileDetail[]> {
  const q = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
  const fields = encodeURIComponent(
    "files(id,name,mimeType,size,createdTime,imageMediaMetadata(width,height),videoMediaMetadata(width,height))",
  );
  const data = await driveFetch(
    token,
    `/files?q=${q}&fields=${fields}&pageSize=1000&orderBy=name&supportsAllDrives=true&includeItemsFromAllDrives=true`,
  );
  return (data.files || []).map((f: any) => ({
    id: String(f.id),
    name: String(f.name || ""),
    mimeType: f.mimeType ?? null,
    size: f.size != null ? Number(f.size) : null,
    createdTime: f.createdTime ?? null,
    width: f.imageMediaMetadata?.width ?? f.videoMediaMetadata?.width ?? null,
    height: f.imageMediaMetadata?.height ?? f.videoMediaMetadata?.height ?? null,
  }));
}

/* ------------------------------------------------------------------ */
/* Streaming read (used by training-media-proxy)                       */
/* ------------------------------------------------------------------ */

/**
 * Streams a Drive file through the connector gateway, forwarding an optional
 * Range header. Returns the raw upstream Response (body is a stream).
 */
export async function driveStreamFile(fileId: string, range?: string | null): Promise<Response> {
  const headers: Record<string, string> = { ...(gwHeaders() as Record<string, string>) };
  if (range) headers.Range = range;
  return await fetch(
    `${GATEWAY_BASE}${DRIVE_PATH}/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`,
    { headers },
  );
}

/** Metadata needed to authorize and describe a media file. */
export async function driveGetAccessMeta(fileId: string): Promise<{
  id: string;
  name: string;
  mimeType: string | null;
  size: number | null;
  parents: string[];
  width: number | null;
  height: number | null;
  durationMillis: number | null;
  trashed: boolean;
} | null> {
  try {
    const data = await driveFetch(
      "gateway",
      `/files/${encodeURIComponent(fileId)}?fields=id,name,mimeType,size,parents,trashed,imageMediaMetadata(width,height),videoMediaMetadata(width,height,durationMillis)&supportsAllDrives=true`,
    );
    return {
      id: String(data.id),
      name: String(data.name || ""),
      mimeType: data.mimeType ?? null,
      size: data.size != null ? Number(data.size) : null,
      parents: Array.isArray(data.parents) ? data.parents.map(String) : [],
      width: data.imageMediaMetadata?.width ?? data.videoMediaMetadata?.width ?? null,
      height: data.imageMediaMetadata?.height ?? data.videoMediaMetadata?.height ?? null,
      durationMillis: data.videoMediaMetadata?.durationMillis != null ? Number(data.videoMediaMetadata.durationMillis) : null,
      trashed: !!data.trashed,
    };
  } catch {
    return null;
  }
}

/** Short-lived Google thumbnail URL (used for previews; never authoritative). */
export async function driveGetThumbnailLink(fileId: string, size = 1600): Promise<string | null> {
  try {
    const data = await driveFetch("gateway", `/files/${encodeURIComponent(fileId)}?fields=thumbnailLink&supportsAllDrives=true`);
    const link = data?.thumbnailLink ? String(data.thumbnailLink) : null;
    return link ? link.replace(/=s\d+$/, `=s${size}`) : null;
  } catch {
    return null;
  }
}
