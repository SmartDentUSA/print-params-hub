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