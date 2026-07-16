// Shared Google Drive helpers used by training-create-drive-folder,
// smartops-gerar-doc-turma, generate-certificate, etc.
//
// Auth: service account (GOOGLE_SERVICE_ACCOUNT_JSON) → OAuth access token.
// Scope: https://www.googleapis.com/auth/drive

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";

function b64url(input: ArrayBuffer | string): string {
  let bytes: Uint8Array;
  if (typeof input === "string") bytes = new TextEncoder().encode(input);
  else bytes = new Uint8Array(input);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

let cachedToken: { token: string; exp: number } | null = null;

export async function getDriveAccessToken(): Promise<string> {
  const raw = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON not configured");
  if (cachedToken && cachedToken.exp > Date.now() / 1000 + 60) return cachedToken.token;

  const sa = JSON.parse(raw);
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 3600;
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/drive",
    aud: "https://oauth2.googleapis.com/token",
    iat,
    exp,
  };
  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claim))}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(sa.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  const jwt = `${unsigned}.${b64url(sig)}`;

  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!resp.ok) throw new Error(`Google token error ${resp.status}: ${await resp.text()}`);
  const data = await resp.json();
  cachedToken = { token: data.access_token, exp };
  return data.access_token;
}

async function driveFetch(token: string, path: string, init: RequestInit = {}, isUpload = false): Promise<any> {
  const base = isUpload ? UPLOAD_API : DRIVE_API;
  const resp = await fetch(`${base}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init.headers || {}) },
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
  const { token, folderId, name, content, mimeType } = opts;
  let existingId = opts.existingFileId || null;
  if (!existingId && opts.overwriteByName) {
    existingId = await driveFindChild(token, folderId, name, false);
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

  const resp = await fetch(`${UPLOAD_API}${path}`, {
    method: existingId ? "PATCH" : "POST",
    headers: {
      Authorization: `Bearer ${token}`,
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