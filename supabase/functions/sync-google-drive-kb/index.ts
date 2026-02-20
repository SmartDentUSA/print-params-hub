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

// ── Category mapping ──────────────────────────────────────────────────────────
function folderNameToCategory(name: string): string {
  const normalized = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents
    .replace(/[^a-z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");

  const map: Record<string, string> = {
    sdr: "sdr",
    sdrs: "sdr",
    comercial: "comercial",
    vendas: "comercial",
    sales: "comercial",
    workflow: "workflow",
    fluxo: "workflow",
    processo: "workflow",
    suporte: "suporte",
    support: "suporte",
    atendimento: "suporte",
    faq: "faq",
    perguntas: "faq",
    objecoes: "objecoes",
    objecao: "objecoes",
    objections: "objecoes",
    onboarding: "onboarding",
    integracao: "onboarding",
    leads: "leads",
    lead: "leads",
    captacao: "leads",
    clientes: "clientes",
    cliente: "clientes",
    customers: "clientes",
    campanhas: "campanhas",
    campanha: "campanhas",
    marketing: "campanhas",
    pos_venda: "pos_venda",
    pos_vendas: "pos_venda",
    posvenda: "pos_venda",
    posvendas: "pos_venda",
    retencao: "pos_venda",
    geral: "geral",
    outros: "geral",
    misc: "geral",
  };

  return map[normalized] || "geral";
}

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

async function listSubfolders(folderId: string): Promise<Array<{ id: string; name: string }>> {
  const data = await driveGet("/files", {
    q: `'${folderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: "files(id,name)",
    pageSize: "100",
  });
  return data.files || [];
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

async function exportAsText(fileId: string, mimeType: string): Promise<string> {
  // Google Docs and DOCX → export as plain text
  const url = new URL(`${DRIVE_API}/files/${fileId}/export`);
  url.searchParams.set("key", GOOGLE_DRIVE_API_KEY);
  url.searchParams.set("mimeType", "text/plain");
  const resp = await fetch(url.toString());
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Export error ${resp.status}: ${err}`);
  }
  const text = await resp.text();
  return text.trim();
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

    // Get root_folder_id from body or site_settings
    let rootFolderId = "";
    let sourceLabel = "Drive KB";

    try {
      const body = await req.json();
      rootFolderId = body.root_folder_id || "";
      sourceLabel = body.source_label || sourceLabel;
    } catch {
      // no body or invalid JSON — try site_settings
    }

    if (!rootFolderId) {
      const { data: setting } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "drive_kb_root_folder_id")
        .maybeSingle();
      rootFolderId = setting?.value || "";
    }

    if (!rootFolderId) {
      return new Response(JSON.stringify({ error: "root_folder_id não fornecido e drive_kb_root_folder_id não configurado em site_settings" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract folder ID from URL if a full URL was provided
    const urlMatch = rootFolderId.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    if (urlMatch) rootFolderId = urlMatch[1];

    // Load source label from settings if not in body
    if (sourceLabel === "Drive KB") {
      const { data: labelSetting } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "drive_kb_source_label")
        .maybeSingle();
      if (labelSetting?.value) sourceLabel = labelSetting.value;
    }

    console.log(`[sync-google-drive-kb] root: ${rootFolderId}, source_label: ${sourceLabel}`);

    // List subfolders
    const subfolders = await listSubfolders(rootFolderId);
    console.log(`[sync-google-drive-kb] ${subfolders.length} subpastas encontradas`);

    // Also process files directly in root folder (mapped to 'geral')
    const allFolders = [
      { id: rootFolderId, name: "geral" },
      ...subfolders,
    ];

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
      kb_text_id?: string;
      source_label: string;
    }> = [];

    for (const folder of allFolders) {
      const category = folderNameToCategory(folder.name);
      let files: Array<{ id: string; name: string; mimeType: string; modifiedTime: string }> = [];

      try {
        files = await listFiles(folder.id);
      } catch (e: any) {
        console.warn(`[sync] Erro listando arquivos em ${folder.name}: ${e.message}`);
        continue;
      }

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
            folder_name: folder.name,
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
            content = await exportAsText(file.id, file.mimeType);
          } else if (file.mimeType === "application/pdf") {
            const base64 = await downloadPdfAsBase64(file.id);
            content = await extractPdfText(base64);
          }

          if (!content.trim()) throw new Error("Conteúdo vazio após extração");

          const title = file.name.replace(/\.[^.]+$/, ""); // remove extension
          const ingestResult = await ingestText([
            { title, category, source_label: sourceLabel, content },
          ]);

          const kbTextId = ingestResult?.results?.[0] ? undefined : undefined;

          processed++;
          byCategory[category] = (byCategory[category] || 0) + 1;

          logEntries.push({
            drive_file_id: file.id,
            file_name: file.name,
            folder_name: folder.name,
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
            folder_name: folder.name,
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
            {
              ...entry,
              processed_at: new Date().toISOString(),
            },
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
