import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GOOGLE_SERVICE_ACCOUNT_JSON = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON")!;
const GOOGLE_DRIVE_PARENT_FOLDER_ID = Deno.env.get("GOOGLE_DRIVE_PARENT_FOLDER_ID")!;

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";
const SUBFOLDERS = ["dia1", "dia2", "dia3", "depoimentos", "fotos_grupo"];
const MESES_PT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

// ── Auth: Service account JWT → access_token ─────────────────────────────────
function base64UrlEncode(input: ArrayBuffer | string): string {
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

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.exp > Date.now() / 1000 + 60) return cachedToken.token;

  const sa = JSON.parse(GOOGLE_SERVICE_ACCOUNT_JSON);
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
  const unsigned = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(claim))}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(sa.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  const jwt = `${unsigned}.${base64UrlEncode(sig)}`;

  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Google token error ${resp.status}: ${err}`);
  }
  const data = await resp.json();
  cachedToken = { token: data.access_token, exp };
  return data.access_token;
}

// ── Drive helpers ────────────────────────────────────────────────────────────
async function driveFetch(token: string, path: string, init: RequestInit = {}, isUpload = false) {
  const base = isUpload ? UPLOAD_API : DRIVE_API;
  const resp = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.headers || {}),
    },
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Drive ${path} ${resp.status}: ${err}`);
  }
  return resp.json();
}

async function createFolder(token: string, name: string, parentId: string): Promise<string> {
  const data = await driveFetch(token, "/files?fields=id", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    }),
  });
  return data.id;
}

async function findFile(token: string, parentId: string, name: string): Promise<string | null> {
  const q = encodeURIComponent(`'${parentId}' in parents and name='${name}' and trashed=false`);
  const data = await driveFetch(token, `/files?q=${q}&fields=files(id)`);
  return data.files?.[0]?.id ?? null;
}

async function uploadJson(
  token: string,
  folderId: string,
  name: string,
  content: string,
  existingId: string | null,
): Promise<void> {
  const boundary = `bdry_${crypto.randomUUID()}`;
  const metadata = existingId
    ? { name }
    : { name, parents: [folderId], mimeType: "application/json" };

  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/json\r\n\r\n` +
    `${content}\r\n` +
    `--${boundary}--`;

  const path = existingId
    ? `/files/${existingId}?uploadType=multipart&fields=id`
    : `/files?uploadType=multipart&fields=id`;

  await driveFetch(
    token,
    path,
    {
      method: existingId ? "PATCH" : "POST",
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      body,
    },
    true,
  );
}

// ── Date formatting ──────────────────────────────────────────────────────────
function formatTurmaDates(days: any[]): string {
  if (!days || days.length === 0) return "sem-data";
  const parsed = days
    .map((d) => {
      const raw = d?.day_date || d?.date || d;
      if (!raw) return null;
      // YYYY-MM-DD → Date local
      const [y, m, dd] = String(raw).slice(0, 10).split("-").map(Number);
      if (!y || !m || !dd) return null;
      return { y, m, dd };
    })
    .filter((x): x is { y: number; m: number; dd: number } => !!x)
    .sort((a, b) => a.y - b.y || a.m - b.m || a.dd - b.dd);

  if (parsed.length === 0) return "sem-data";

  const sameMonth = parsed.every((p) => p.m === parsed[0].m && p.y === parsed[0].y);
  if (sameMonth) {
    const dias = parsed.map((p) => p.dd).join(",");
    return `${dias} ${MESES_PT[parsed[0].m - 1]} ${parsed[0].y}`;
  }
  // Mixed months
  const parts = parsed.map((p) => `${p.dd} ${MESES_PT[p.m - 1]}`);
  return `${parts.join(", ")} ${parsed[parsed.length - 1].y}`;
}

function sanitize(name: string): string {
  return name.replace(/[\/\\]/g, "-").replace(/\s+/g, " ").trim();
}

// ── Main ─────────────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!GOOGLE_SERVICE_ACCOUNT_JSON || !GOOGLE_DRIVE_PARENT_FOLDER_ID) {
      return new Response(
        JSON.stringify({ error: "GOOGLE_SERVICE_ACCOUNT_JSON ou GOOGLE_DRIVE_PARENT_FOLDER_ID não configurados" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json().catch(() => ({}));
    const turma_id: string | undefined = body?.turma_id;
    const update_only: boolean = !!body?.update_only;
    if (!turma_id || typeof turma_id !== "string") {
      return new Response(JSON.stringify({ error: "turma_id obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1) Factory data
    const { data: factoryData, error: rpcErr } = await supabase.rpc("fn_get_turma_factory_data", {
      p_turma_id: turma_id,
    });
    if (rpcErr) throw new Error(`fn_get_turma_factory_data: ${rpcErr.message}`);
    if (!factoryData) throw new Error("Turma não encontrada");

    // 2) Existing folder id
    const { data: turmaRow, error: turmaErr } = await supabase
      .from("smartops_course_turmas")
      .select("id, factory_drive_folder_id, factory_drive_folder_url")
      .eq("id", turma_id)
      .maybeSingle();
    if (turmaErr) throw new Error(`turma fetch: ${turmaErr.message}`);

    const token = await getAccessToken();
    let folderId = turmaRow?.factory_drive_folder_id || null;
    let folderUrl = turmaRow?.factory_drive_folder_url || null;
    let created = false;

    const shouldCreate = !update_only && !folderId;

    if (shouldCreate) {
      const turma = (factoryData as any)?.turma || (factoryData as any);
      const curso = (factoryData as any)?.curso || (factoryData as any)?.course || {};
      const days = (factoryData as any)?.days || turma?.days || [];
      const turmaNumber = turma?.turma_number ?? turma?.number ?? "S/N";
      const cursoNome = curso?.name || curso?.title || curso?.slug || "Curso";
      const dateStr = formatTurmaDates(days);
      const folderName = sanitize(`${turmaNumber} - ${cursoNome} - ${dateStr}`);

      folderId = await createFolder(token, folderName, GOOGLE_DRIVE_PARENT_FOLDER_ID);
      folderUrl = `https://drive.google.com/drive/folders/${folderId}`;

      // Subpastas (parallel, tolerantes a falha individual)
      await Promise.allSettled(
        SUBFOLDERS.map((sub) =>
          createFolder(token, sub, folderId!).catch((e) => {
            console.warn(`[training-create-drive-folder] subpasta ${sub} falhou: ${e.message}`);
          }),
        ),
      );

      const { error: updErr } = await supabase
        .from("smartops_course_turmas")
        .update({
          factory_drive_folder_id: folderId,
          factory_drive_folder_url: folderUrl,
        })
        .eq("id", turma_id);
      if (updErr) throw new Error(`update turma: ${updErr.message}`);
      created = true;
    }

    let updatedJson = false;
    if (folderId) {
      const existingJsonId = await findFile(token, folderId, "turma.json");
      await uploadJson(token, folderId, "turma.json", JSON.stringify(factoryData, null, 2), existingJsonId);
      updatedJson = true;
    }

    return new Response(
      JSON.stringify({ ok: true, folder_id: folderId, folder_url: folderUrl, created, updated_json: updatedJson }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("[training-create-drive-folder]", err);
    return new Response(JSON.stringify({ error: err?.message || String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});