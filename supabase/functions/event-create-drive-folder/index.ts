// Cria (ou atualiza) a pasta do evento no Google Drive com toda a árvore de
// subpastas do pipeline de publicação de eventos e grava o descritivo do evento
// em JSON e DOCX. Mesmo padrão de training-create-drive-folder.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  getDriveAccessToken,
  driveCreateFolder,
  driveEnsureFolder,
  driveUploadFile,
  sanitizeFolderName,
} from "../_shared/drive.ts";
import { buildSimpleDocx, DOCX_MIME, type DocxParagraph } from "../_shared/docx.ts";
import {
  buildEventPlan,
  eventDays,
  eventFolderName,
  planToDestinations,
  speakerNames,
  type EventLite,
} from "../_shared/event-drive-spec.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const EVENTS_PARENT =
  Deno.env.get("GOOGLE_DRIVE_EVENTS_PARENT_FOLDER_ID") || "1ged_8WdpJ-CQXfhAYw0SkQDmtNx8cX7b";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function authorize(req: Request): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const header = req.headers.get("Authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token || token === ANON_KEY) return { ok: false, status: 401, error: "Autenticação obrigatória" };
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data?.user) return { ok: false, status: 401, error: "Sessão inválida ou expirada" };
  const { data: allowed, error: permErr } = await userClient.rpc("can_manage_training_media", {
    _user_id: data.user.id,
  });
  if (permErr) return { ok: false, status: 403, error: `Falha ao validar permissão: ${permErr.message}` };
  if (allowed !== true) return { ok: false, status: 403, error: "Usuário sem permissão de equipe" };
  return { ok: true };
}

function buildDescriptor(ev: any) {
  const days = eventDays(ev as EventLite);
  return {
    evento: {
      id: ev.id,
      nome: ev.name,
      local: ev.location || null,
      pais: ev.country || null,
      estande: ev.company_stand || null,
      site: ev.website_url || null,
      instagram: ev.instagram_handle || null,
      data_inicio: ev.start_date || null,
      data_fim: ev.end_date || null,
      dias: days,
      publico_areas: ev.audience_areas || [],
      publico_especialidades: ev.audience_specialties || [],
      publico_observacoes: ev.audience_notes || null,
      sobre: ev.about_event_pt || null,
      observacoes: ev.notes || null,
    },
    palestrantes: Array.isArray(ev.speakers) ? ev.speakers : [],
    marcas_parceiras: Array.isArray(ev.partner_brands) ? ev.partner_brands : [],
    orientacao_comunicacao: [
      "Toda copy deve mencionar o local: estande da Smart Dent no evento.",
      "Nunca incluir preço, promessa clínica ou dados pessoais nas artes.",
      "Nomes de clientes somente na legenda, com autorização.",
    ],
  };
}

function buildDocxParagraphs(ev: any): DocxParagraph[] {
  const days = eventDays(ev as EventLite);
  const speakers = Array.isArray(ev.speakers) ? ev.speakers : [];
  const brands = Array.isArray(ev.partner_brands) ? ev.partner_brands : [];
  const p: DocxParagraph[] = [
    { text: String(ev.name || "Evento").toUpperCase(), heading: true },
    { text: "DADOS DO EVENTO", bold: true },
    { text: `Local: ${ev.location || "—"}${ev.country ? ` (${ev.country})` : ""}` },
    { text: `Estande Smart Dent: ${ev.company_stand || "—"}` },
    { text: `Período: ${ev.start_date || "—"}${ev.end_date && ev.end_date !== ev.start_date ? ` a ${ev.end_date}` : ""}` },
    { text: `Dias de evento: ${days.length}` },
    { text: `Site: ${ev.website_url || "—"}` },
    { text: `Instagram: ${ev.instagram_handle || "—"}` },
    { text: "PÚBLICO", bold: true },
    { text: `Áreas: ${(ev.audience_areas || []).join(", ") || "—"}` },
    { text: `Especialidades: ${(ev.audience_specialties || []).join(", ") || "—"}` },
    { text: `Observações: ${ev.audience_notes || "—"}` },
    { text: "SOBRE O EVENTO", bold: true },
    { text: ev.about_event_pt || "—" },
    { text: "PALESTRANTES / KOLs", bold: true },
  ];
  if (speakers.length) {
    for (const s of speakers) {
      p.push({ text: `• ${s?.name || "—"}${s?.theme ? ` — ${s.theme}` : ""}${s?.instagram ? ` (${s.instagram})` : ""}` });
    }
  } else p.push({ text: "—" });
  p.push({ text: "MARCAS PARCEIRAS", bold: true });
  if (brands.length) for (const b of brands) p.push({ text: `• ${b?.name || "—"}${b?.instagram ? ` (${b.instagram})` : ""}` });
  else p.push({ text: "—" });
  p.push({ text: "ORIENTAÇÃO PARA COMUNICAÇÃO", bold: true });
  p.push({ text: "Toda copy deve citar o local: estande da Smart Dent no evento." });
  p.push({ text: "Sem preços, sem promessa de resultado clínico, sem dados pessoais nas artes." });
  p.push({ text: "OBSERVAÇÕES INTERNAS", bold: true });
  p.push({ text: ev.notes || "—" });
  return p;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = await authorize(req);
    if (!auth.ok) return json({ error: auth.error }, auth.status);

    const body = await req.json().catch(() => ({}));
    const eventId = String(body?.event_id || "");
    const refreshDescription = !!body?.refresh_description;
    if (!eventId) return json({ error: "event_id obrigatório" }, 400);

    const db = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
    const { data: ev, error } = await db.from("smartops_events").select("*").eq("id", eventId).maybeSingle();
    if (error) throw new Error(`evento: ${error.message}`);
    if (!ev) return json({ error: "Evento não encontrado" }, 404);

    const token = await getDriveAccessToken();
    const canonicalName = sanitizeFolderName(eventFolderName(ev as EventLite));
    const hasFolder = !!ev.drive_folder_id && !!ev.drive_folder_created_at;

    let folderId: string | null = hasFolder ? ev.drive_folder_id : null;
    let folderUrl: string | null = hasFolder ? ev.drive_folder_url : null;
    let created = false;
    if (!folderId) {
      folderId = await driveCreateFolder(token, canonicalName, EVENTS_PARENT);
      folderUrl = `https://drive.google.com/drive/folders/${folderId}`;
      created = true;
    }

    // Árvore completa (idempotente: driveEnsureFolder reaproveita pastas).
    const plan = buildEventPlan(ev as EventLite);
    const subfolders: Record<string, string> = hasFolder
      ? ({ ...(ev.drive_subfolders || {}) } as Record<string, string>)
      : {};
    const pathCache = new Map<string, string>();
    for (const dest of plan) {
      let parentId = folderId!;
      let path = "";
      for (const seg of dest.segments) {
        path = `${path}/${seg}`;
        const cached = pathCache.get(path);
        if (cached) {
          parentId = cached;
          continue;
        }
        const id = await driveEnsureFolder(token, parentId, sanitizeFolderName(seg));
        pathCache.set(path, id);
        parentId = id;
      }
      subfolders[dest.key] = parentId;
    }

    const descriptor = buildDescriptor(ev);
    let jsonFileId = ev.drive_json_file_id as string | null;
    let docxFileId = ev.drive_docx_file_id as string | null;

    try {
      jsonFileId = await driveUploadFile({
        token,
        folderId: folderId!,
        name: "descritivo_do_evento.json",
        content: JSON.stringify(descriptor, null, 2),
        mimeType: "application/json",
        existingFileId: jsonFileId || undefined,
        overwriteByName: true,
      });
    } catch (e) {
      console.warn(`[event-create-drive-folder] json falhou: ${(e as Error).message}`);
    }

    if (created || refreshDescription || !docxFileId) {
      try {
        const docx = await buildSimpleDocx(buildDocxParagraphs(ev));
        docxFileId = await driveUploadFile({
          token,
          folderId: folderId!,
          name: "descritivo_do_evento.docx",
          content: docx,
          mimeType: DOCX_MIME,
          existingFileId: docxFileId || undefined,
          overwriteByName: true,
        });
      } catch (e) {
        console.warn(`[event-create-drive-folder] docx falhou: ${(e as Error).message}`);
      }
    }

    const payload: Record<string, unknown> = {
      drive_folder_id: folderId,
      drive_folder_url: folderUrl,
      drive_folder_name: canonicalName,
      drive_subfolders: subfolders,
      drive_destinations: planToDestinations(plan),
      drive_json_file_id: jsonFileId,
      drive_docx_file_id: docxFileId,
    };
    if (created) payload.drive_folder_created_at = new Date().toISOString();
    const { error: updErr } = await db.from("smartops_events").update(payload).eq("id", eventId);
    if (updErr) throw new Error(`update evento: ${updErr.message}`);

    console.log(JSON.stringify({
      event: "event_drive_folder_ready",
      event_id: eventId,
      folder_id: folderId,
      created,
      folders: plan.length,
      speakers: speakerNames(ev as EventLite).length,
      days: eventDays(ev as EventLite).length,
    }));

    return json({
      ok: true,
      folder_id: folderId,
      folder_url: folderUrl,
      folder_name: canonicalName,
      created,
      destinations: planToDestinations(plan),
    });
  } catch (err: any) {
    console.error("[event-create-drive-folder]", err);
    return json({ error: err?.message || String(err) }, 500);
  }
});
