import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GOOGLE_DRIVE_API_KEY = Deno.env.get("GOOGLE_DRIVE_API_KEY")!;

const DRIVE_API = "https://www.googleapis.com/drive/v3";

// ── Drive API helpers ─────────────────────────────────────────────────────────
async function driveGet(path: string, params: Record<string, string> = {}) {
  const url = new URL(`${DRIVE_API}${path}`);
  url.searchParams.set("key", GOOGLE_DRIVE_API_KEY);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const resp = await fetch(url.toString());
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Drive API error ${resp.status}: ${err}`);
  }
  return resp.json();
}

async function listFiles(folderId: string): Promise<Array<{ id: string; name: string; mimeType: string; modifiedTime: string }>> {
  const supportedTypes = [
    "application/vnd.google-apps.document",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/pdf",
  ];
  const mimeFilter = supportedTypes.map((m) => `mimeType='${m}'`).join(" or ");
  const data = await driveGet("/files", {
    q: `'${folderId}' in parents and (${mimeFilter}) and trashed=false`,
    fields: "files(id,name,mimeType,modifiedTime)",
    pageSize: "200",
  });
  return data.files || [];
}

async function exportAsText(fileId: string): Promise<string> {
  const url = new URL(`${DRIVE_API}/files/${fileId}/export`);
  url.searchParams.set("key", GOOGLE_DRIVE_API_KEY);
  url.searchParams.set("mimeType", "text/plain");
  const resp = await fetch(url.toString());
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Export error ${resp.status}: ${err}`);
  }
  return (await resp.text()).trim();
}

async function downloadPdfAsBase64(fileId: string): Promise<string> {
  const url = new URL(`${DRIVE_API}/files/${fileId}`);
  url.searchParams.set("key", GOOGLE_DRIVE_API_KEY);
  url.searchParams.set("alt", "media");
  const resp = await fetch(url.toString());
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Download error ${resp.status}: ${err}`);
  }
  const buffer = await resp.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

async function extractPdfText(pdfBase64: string): Promise<string> {
  const resp = await fetch(`${SUPABASE_URL}/functions/v1/extract-pdf-text`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ pdfBase64 }),
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`extract-pdf-text error ${resp.status}: ${err}`);
  }
  const data = await resp.json();
  if (!data.extractedText) throw new Error("PDF sem texto extraído");
  return data.extractedText;
}

async function ingestText(entries: Array<{ title: string; category: string; source_label: string; content: string }>) {
  const resp = await fetch(`${SUPABASE_URL}/functions/v1/ingest-knowledge-text`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ entries }),
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`ingest-knowledge-text error ${resp.status}: ${err}`);
  }
  return resp.json();
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Extract folder ID from URL or return as-is ───────────────────────────────
function extractFolderId(rawId: string): string {
  const match = rawId.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : rawId.trim();
}

// ── Main handler ─────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!GOOGLE_DRIVE_API_KEY) {
      return new Response(JSON.stringify({ error: "GOOGLE_DRIVE_API_KEY não configurada no Supabase Secrets" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ── Read folder_map from body or site_settings ────────────────────────────
    let folderMap: Record<string, string> = {};
    let sourceLabel = "Drive KB";

    try {
      const body = await req.json();
      if (body.folder_map && typeof body.folder_map === "object") {
        folderMap = body.folder_map;
      }
      if (body.source_label) sourceLabel = body.source_label;
    } catch {
      // no body or invalid JSON — will fall through to site_settings
    }

    // Fall back to site_settings if folder_map is empty
    if (Object.keys(folderMap).length === 0) {
      const { data: mapSetting } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "drive_kb_folder_map")
        .maybeSingle();
      try {
        if (mapSetting?.value) Object.assign(folderMap, JSON.parse(mapSetting.value));
      } catch {}
    }

    if (sourceLabel === "Drive KB") {
      const { data: labelSetting } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "drive_kb_source_label")
        .maybeSingle();
      if (labelSetting?.value) sourceLabel = labelSetting.value;
    }

    // Build the list of folders to process (category is explicit)
    const allFolders = Object.entries(folderMap)
      .filter(([, rawId]) => rawId?.trim())
      .map(([category, rawId]) => ({
        id: extractFolderId(rawId),
        category,
      }));

    if (allFolders.length === 0) {
      return new Response(
        JSON.stringify({ error: "Nenhuma pasta configurada em folder_map. Configure as pastas na aba Cérebro Externo." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[sync-google-drive-kb] ${allFolders.length} categorias configuradas, source_label: ${sourceLabel}`);

    let processed = 0;
    let skipped = 0;
    let errors = 0;
    const byCategory: Record<string, number> = {};
    const logEntries: Array<{
      drive_file_id: string;
      file_name: string;
      folder_name: string;
      category: string;
      mime_type: string;
      modified_time: string;
      status: string;
      error_msg?: string;
      source_label: string;
    }> = [];

    for (const { id: folderId, category } of allFolders) {
      let files: Array<{ id: string; name: string; mimeType: string; modifiedTime: string }> = [];

      try {
        files = await listFiles(folderId);
      } catch (e: any) {
        console.warn(`[sync] Erro listando arquivos em ${category} (${folderId}): ${e.message}`);
        continue;
      }

      console.log(`[sync] Categoria ${category}: ${files.length} arquivos encontrados`);

      for (const file of files) {
        // Check if file was already processed with same modifiedTime
        const { data: existingLog } = await supabase
          .from("drive_kb_sync_log")
          .select("modified_time, status")
          .eq("drive_file_id", file.id)
          .maybeSingle();

        if (existingLog?.modified_time === file.modifiedTime && existingLog?.status === "done") {
          skipped++;
          logEntries.push({
            drive_file_id: file.id,
            file_name: file.name,
            folder_name: category,
            category,
            mime_type: file.mimeType,
            modified_time: file.modifiedTime,
            status: "skipped",
            source_label: sourceLabel,
          });
          continue;
        }

        console.log(`[sync] Processando: ${file.name} (${category})`);

        try {
          let content = "";

          if (
            file.mimeType === "application/vnd.google-apps.document" ||
            file.mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          ) {
            content = await exportAsText(file.id);
          } else if (file.mimeType === "application/pdf") {
            const base64 = await downloadPdfAsBase64(file.id);
            content = await extractPdfText(base64);
          }

          if (!content.trim()) throw new Error("Conteúdo vazio após extração");

          const title = file.name.replace(/\.[^.]+$/, ""); // remove extension
          await ingestText([{ title, category, source_label: sourceLabel, content }]);

          processed++;
          byCategory[category] = (byCategory[category] || 0) + 1;

          logEntries.push({
            drive_file_id: file.id,
            file_name: file.name,
            folder_name: category,
            category,
            mime_type: file.mimeType,
            modified_time: file.modifiedTime,
            status: "done",
            source_label: sourceLabel,
          });

          // Rate limit between files
          await sleep(1500);
        } catch (fileErr: any) {
          errors++;
          console.error(`[sync] Erro em ${file.name}: ${fileErr.message}`);
          logEntries.push({
            drive_file_id: file.id,
            file_name: file.name,
            folder_name: category,
            category,
            mime_type: file.mimeType,
            modified_time: file.modifiedTime,
            status: "error",
            error_msg: fileErr.message,
            source_label: sourceLabel,
          });
        }
      }
    }

    // Upsert all log entries
    if (logEntries.length > 0) {
      for (const entry of logEntries) {
        await supabase
          .from("drive_kb_sync_log")
          .upsert(
            { ...entry, processed_at: new Date().toISOString() },
            { onConflict: "drive_file_id", ignoreDuplicates: false }
          );
      }
    }

    const result = { processed, skipped, errors, by_category: byCategory };
    console.log("[sync-google-drive-kb] Concluído:", result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[sync-google-drive-kb]", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
