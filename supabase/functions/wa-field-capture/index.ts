// wa-field-capture — vendedores (Team Members) enviam ao número oficial (Zernio) fotos de cartões,
// áudios, anotações e fotos/vídeos de produtos. Tudo até a palavra FIM vira uma captura:
// a IA transcreve/lê, extrai os dados do lead, os arquivos vão para a pasta do evento do dia no Drive
// e o lead entra no CRM pelo caminho oficial (smart-ops-ingest-lead) com o formulário do evento:
//   LEAD → formulário de cadastro de leads do evento (feira_evento), dono = vendedor que enviou
//   KOL → formulário KOL Expansão do evento (funil 109840, Beatriz)
//   OPORTUNIDADE → formulário de sistema "oportunidade_evento" do evento (funil 109841, Beatriz)
// Chamado pelo gatilho trg_dispatch_field_capture (whatsapp_inbox) com o id da mensagem já gravada;
// age só sobre remetentes da equipe e é idempotente por wamid. Não envia nada fora da conversa do vendedor.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { encodeBase64 } from "jsr:@std/encoding@1/base64";
import {
  getDriveAccessToken, driveEnsureFolder, driveUploadFile, driveGetWebViewLink, driveRename, sanitizeFolderName,
} from "../_shared/drive.ts";
import { PRODUCT_CATALOG_ENTITY_TYPES } from "./catalog-types.ts";
import {
  parseCommand, type CaptureType, extractFallback, opportunityName, fileName,
  parseConfirmChoice, validateEdit, applyEdits, hasContact, confirmSummary, EDIT_PROMPT, type ConfirmField,
} from "./logic.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const ZERNIO = "https://zernio.com/api/v1";
const AI = "https://ai.gateway.lovable.dev/v1/chat/completions";
const VISION_MODEL = "google/gemini-3.8-flash";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_AI_BYTES = 18 * 1024 * 1024;
const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const TYPE_LABEL: Record<CaptureType, string> = { lead: "Lead do evento", kol: "KOL evento", oportunidade: "Oportunidade do evento" };
const MENU = "Responda com o tipo:\n1 - LEAD (lead do evento)\n2 - KOL (KOL evento)\n3 - OPORTUNIDADE (oportunidade do evento)\n\nDepois mande cartões, áudios, fotos e vídeos e termine com *FIM*. Para desistir: *CANCELAR*.";

async function reply(session: { account_id: string; conversation_id: string | null }, text: string) {
  const key = Deno.env.get("ZERNIO_API_KEY");
  if (!key || !session.conversation_id) return;
  const r = await fetch(`${ZERNIO}/inbox/conversations/${encodeURIComponent(session.conversation_id)}/messages`, {
    method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ accountId: session.account_id, message: text }),
  }).catch((e) => { console.error("[wa-field-capture] reply", e); return null; });
  if (r && !r.ok) console.error(`[wa-field-capture] reply failed [${r.status}]: ${(await r.text()).slice(0, 300)}`);
}

/** Evento acontecendo hoje (São Paulo); feiras/congressos antes de campanhas promocionais. */
async function todayEvent() {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const { data } = await db.from("smartops_events").select("id, name, event_type, drive_folder_id, start_date, end_date")
    .eq("is_active", true).lte("start_date", today).gte("end_date", today).order("start_date", { ascending: false }).limit(10);
  const list = (data ?? []) as any[];
  return list.find((e) => e.event_type !== "campanha_promocional") ?? null;
}

async function ensureEventFolder(event: any): Promise<string | null> {
  if (event.drive_folder_id) return event.drive_folder_id;
  await fetch(`${SUPABASE_URL}/functions/v1/event-create-drive-folder`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY },
    body: JSON.stringify({ event_id: event.id }),
  }).catch(() => null);
  const { data } = await db.from("smartops_events").select("drive_folder_id").eq("id", event.id).maybeSingle();
  return data?.drive_folder_id ?? null;
}

async function sessionFolder(session: any): Promise<string> {
  if (session.drive_folder_id) return session.drive_folder_id;
  const token = await getDriveAccessToken();
  let parent: string | null = null;
  if (session.event_id) {
    const { data: ev } = await db.from("smartops_events").select("id, drive_folder_id").eq("id", session.event_id).maybeSingle();
    if (ev) parent = await ensureEventFolder(ev);
  }
  if (!parent) throw new Error("Pasta do evento no Drive indisponível");
  const base = await driveEnsureFolder(token, parent, "Capturas WhatsApp");
  const folder = await driveEnsureFolder(token, base, `Captura ${session.id.slice(0, 8)}`);
  const url = `https://drive.google.com/drive/folders/${folder}`;
  await db.from("field_capture_sessions").update({ drive_folder_id: folder, drive_folder_url: url }).eq("id", session.id);
  session.drive_folder_id = folder; session.drive_folder_url = url;
  return folder;
}

async function downloadMedia(url: string): Promise<{ bytes: Uint8Array; mime: string } | null> {
  let r = await fetch(url).catch(() => null);
  if (r && (r.status === 401 || r.status === 403)) {
    r = await fetch(url, { headers: { Authorization: `Bearer ${Deno.env.get("ZERNIO_API_KEY") ?? ""}` } }).catch(() => null);
  }
  if (!r || !r.ok) return null;
  return { bytes: new Uint8Array(await r.arrayBuffer()), mime: (r.headers.get("content-type") ?? "").split(";")[0] };
}

async function aiCall(content: unknown[], extra: Record<string, unknown> = {}) {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) throw new Error("LOVABLE_API_KEY ausente");
  const r = await fetch(AI, {
    method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: VISION_MODEL, temperature: 0, messages: [{ role: "user", content }], ...extra }),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`IA ${r.status}: ${t.slice(0, 300)}`);
  return JSON.parse(t);
}

const AUDIO_FORMAT = (mime: string) => mime.includes("mpeg") || mime.includes("mp3") ? "mp3" : mime.includes("wav") ? "wav"
  : mime.includes("aac") || mime.includes("mp4") || mime.includes("m4a") ? "aac" : "ogg";

async function readMedia(kind: string, bytes: Uint8Array, mime: string): Promise<string> {
  if (bytes.length > MAX_AI_BYTES) return "";
  if (kind === "image") {
    const out = await aiCall([
      { type: "image_url", image_url: { url: `data:${mime || "image/jpeg"};base64,${encodeBase64(bytes)}` } },
      { type: "text", text: "Transcreva fielmente todo o texto visível (cartão de visita, anotação, catálogo, embalagem). Se não houver texto, descreva em uma frase o que aparece (ex.: produto). Não invente nada." },
    ]);
    return String(out?.choices?.[0]?.message?.content ?? "").trim();
  }
  if (kind === "audio") {
    const out = await aiCall([
      { type: "input_audio", input_audio: { data: encodeBase64(bytes), format: AUDIO_FORMAT(mime) } },
      { type: "text", text: "Transcreva literalmente este áudio em português, sem resumir e sem inventar." },
    ]);
    return String(out?.choices?.[0]?.message?.content ?? "").trim();
  }
  return "";
}

async function catalogNames(): Promise<string[]> {
  const { data } = await db.from("system_a_catalog").select("name").eq("active", true).in("category", PRODUCT_CATALOG_ENTITY_TYPES).limit(800);
  return [...new Set(((data ?? []) as any[]).map((r) => String(r.name ?? "").trim()).filter(Boolean))];
}

async function extract(material: string, products: string[]) {
  const schema = {
    type: "object", additionalProperties: false,
    properties: {
      nome: { type: "string" }, email: { type: "string" }, telefone: { type: "string" }, empresa: { type: "string" },
      area_atuacao: { type: "string" }, especialidade: { type: "string" }, cidade: { type: "string" },
      estado: { type: "string", description: "UF com 2 letras quando Brasil" }, pais: { type: "string" }, endereco: { type: "string" },
      produtos: { type: "array", items: { type: "string", enum: products.length ? products : ["-"] } },
      resumo: { type: "string" },
    },
    required: ["nome", "email", "telefone", "empresa", "area_atuacao", "especialidade", "cidade", "estado", "pais", "endereco", "produtos", "resumo"],
  };
  const out = await aiCall([{
    type: "text",
    text: `Você recebe o material enviado por um vendedor sobre UMA pessoa conhecida num evento odontológico (texto de cartões, transcrições de áudio e anotações). Extraia os dados. Use string vazia quando não houver a informação — nunca invente. "produtos" só com nomes exatos da lista permitida que forem citados ou mostrados. "resumo" com 2 a 5 frases do que a pessoa busca e próximos passos.\n\nMATERIAL:\n${material.slice(0, 30000)}`,
  }], {
    tools: [{ type: "function", function: { name: "lead", description: "Dados do lead", parameters: schema } }],
    tool_choice: { type: "function", function: { name: "lead" } },
  });
  const args = out?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  return args ? JSON.parse(args) : {};
}

async function formFor(type: CaptureType, event: { id: string; name: string }) {
  if (type === "oportunidade") {
    const { data: f } = await db.from("smartops_forms").select("id, name").eq("event_id", event.id).eq("form_purpose", "oportunidade_evento").limit(1).maybeSingle();
    if (f) return f;
    const name = `# - [OPORTUNIDADE EVENTO] - ${event.name}`.slice(0, 190);
    const slug = `oportunidade-evento-${event.id.slice(0, 8)}`;
    const { data: c, error } = await db.from("smartops_forms").insert({ name, title: name, slug, form_purpose: "oportunidade_evento", active: false, event_id: event.id }).select("id, name").single();
    if (error) throw new Error(`formulário de oportunidade: ${error.message}`);
    return c;
  }
  const purpose = type === "kol" ? "kol_expansao" : "feira_evento";
  const { data: f } = await db.from("smartops_forms").select("id, name").eq("event_id", event.id).eq("form_purpose", purpose)
    .order("active", { ascending: false }).order("created_at", { ascending: true }).limit(1).maybeSingle();
  return f;
}

const READ_KINDS = new Set(["image", "audio"]);
/** Mídia ainda sendo baixada/lida: o handler grava mime_type (e transcript/erro) só ao terminar. */
const isPending = (it: any) => it.kind !== "text" && !it.mime_type && !it.error;

/** Itens da captura prontos para leitura. O FIM pode chegar segundos depois da foto, antes de a IA terminar de lê-la:
 *  espera as mídias pendentes (até ~60 s) e lê de novo, aqui mesmo, imagem/áudio que ficaram sem texto. */
async function readyItems(session: any): Promise<any[]> {
  const load = async () => ((await db.from("field_capture_items").select("*").eq("session_id", session.id).order("created_at")).data ?? []) as any[];
  // Fotos/áudios enviados antes do FIM cujo aviso do WhatsApp ainda não chegou (entregas fora de ordem).
  const { data: sent } = await db.from("whatsapp_inbox").select("id").eq("phone", session.sender_phone).eq("direction", "inbound")
    .not("media_url", "is", null).gte("created_at", session.created_at).lte("created_at", session.last_message_at ?? new Date().toISOString());
  const expected = ((sent ?? []) as any[]).map((r) => r.id);
  const missing = (l: any[]) => expected.some((id) => !l.some((it) => it.inbox_id === id));
  let list = await load();
  for (let i = 0; i < 30 && (list.some(isPending) || missing(list)); i++) {
    await new Promise((r) => setTimeout(r, 2000));
    list = await load();
  }
  for (const it of list) {
    if (!READ_KINDS.has(it.kind) || it.transcript || !it.inbox_id) continue;
    const { data: msg } = await db.from("whatsapp_inbox").select("media_url, media_type").eq("id", it.inbox_id).maybeSingle();
    if (!msg?.media_url) continue;
    const media = await downloadMedia(msg.media_url);
    if (!media) continue;
    const mime = media.mime || String(msg.media_type ?? "") || it.mime_type || "application/octet-stream";
    try {
      const transcript = await readMedia(it.kind, media.bytes, mime);
      if (transcript) {
        it.transcript = transcript;
        await db.from("field_capture_items").update({ transcript, mime_type: it.mime_type ?? mime }).eq("id", it.id);
      }
    } catch (e) { console.error("[wa-field-capture] leitura no FIM", e); }
  }
  return list;
}

const loadItems = async (sessionId: string) =>
  ((await db.from("field_capture_items").select("*").eq("session_id", sessionId).order("created_at")).data ?? []) as any[];

/** Lê o material da captura com a IA e aplica as correções que o vendedor já fez na conferência. */
async function buildLead(session: any, list: any[]) {
  const parts: string[] = [];
  list.forEach((it, i) => {
    const body = it.kind === "text" ? it.text_content : it.transcript;
    if (body) parts.push(`[${i + 1}] ${it.kind.toUpperCase()}: ${body}`);
  });
  const material = parts.join("\n\n");
  const products = await catalogNames();
  let x: any = {};
  try { x = await extract(material, products); } catch (e) { console.error("[wa-field-capture] extract", e); }
  const fb = extractFallback(material);
  const lead = {
    nome: String(x.nome || "").trim(), email: String(x.email || fb.email || "").trim().toLowerCase(),
    telefone: String(x.telefone || fb.telefone || "").replace(/\D/g, ""), empresa: String(x.empresa || "").trim(),
    area_atuacao: String(x.area_atuacao || "").trim(), especialidade: String(x.especialidade || "").trim(),
    cidade: String(x.cidade || "").trim(), estado: String(x.estado || "").trim(), pais: String(x.pais || "").trim(),
    endereco: String(x.endereco || "").trim(),
    produtos: (Array.isArray(x.produtos) ? x.produtos : []).filter((p: string) => products.includes(p)),
    resumo: String(x.resumo || "").trim(),
  };
  return applyEdits(lead, session.confirm_edits);
}

/** FIM: lê tudo e devolve ao vendedor o resumo (nome, telefone, e-mail) para conferência; o lead só nasce no "4". */
async function prepareConfirmation(session: any): Promise<Record<string, unknown>> {
  try {
    if (!session.event_id) throw new Error("Nenhum evento acontecendo na data do envio");
    const list = await readyItems(session);
    if (!list.length) { await reply(session, "Ainda não recebi nada nesta captura. Mande cartões, áudios ou fotos e depois *FIM*."); return { ok: false, empty: true }; }
    const lead = await buildLead(session, list);
    await db.from("field_capture_sessions").update({ extracted: lead, confirm_step: "menu", error: null }).eq("id", session.id).eq("status", "collecting");
    await reply(session, confirmSummary(TYPE_LABEL[session.capture_type as CaptureType], lead));
    return { ok: true, confirming: true };
  } catch (e) {
    const msg = String((e as Error).message ?? e).slice(0, 300);
    await db.from("field_capture_sessions").update({ error: msg }).eq("id", session.id);
    await reply(session, `⚠️ Não consegui ler o material: ${msg}. Mande *FIM* de novo.`);
    return { ok: false, error: msg };
  }
}

/** Respostas do vendedor durante a conferência (menu 1–4 ou o valor corrigido). */
async function handleConfirm(session: any, text: string): Promise<Record<string, unknown>> {
  const lead = applyEdits(session.extracted ?? {}, session.confirm_edits);
  const label = TYPE_LABEL[session.capture_type as CaptureType];
  if (session.confirm_step === "menu") {
    const c = parseConfirmChoice(text);
    if (!c) { await reply(session, "Responda com o número:\n1 - Editar nome\n2 - Editar telefone\n3 - Editar e-mail\n4 - Dados corretos"); return { ok: true, waiting: "menu" }; }
    if (c.kind === "edit") {
      await db.from("field_capture_sessions").update({ confirm_step: c.field }).eq("id", session.id);
      await reply(session, EDIT_PROMPT[c.field]);
      return { ok: true, editing: c.field };
    }
    if (!hasContact(lead)) { await reply(session, "Preciso de telefone ou e-mail para criar o lead. Responda *2* ou *3*."); return { ok: false, missing: "contact" }; }
    await reply(session, "⏳ Dados confirmados. Criando o lead no CRM…");
    return await finalizeSession(session.id, "whatsapp");
  }
  const field = session.confirm_step as ConfirmField;
  const v = validateEdit(field, text);
  if ("error" in v) { await reply(session, v.error); return { ok: false, invalid: field }; }
  const edits = { ...(session.confirm_edits ?? {}), [field]: v.value };
  const updated = applyEdits(session.extracted ?? {}, edits);
  await db.from("field_capture_sessions").update({ confirm_edits: edits, extracted: updated, confirm_step: "menu" }).eq("id", session.id);
  await reply(session, confirmSummary(label, updated));
  return { ok: true, edited: field };
}

/** Cria o lead com os dados conferidos (ou, no reprocessamento pela equipe, com os já guardados). */
async function finalizeSession(sessionId: string, origin: "whatsapp" | "reprocess"): Promise<Record<string, unknown>> {
  const { data: claimed } = await db.from("field_capture_sessions").update({ status: "processing", error: null })
    .eq("id", sessionId).in("status", ["collecting", "error"]).select("*").maybeSingle();
  if (!claimed) return { skipped: "not_open" };
  const session: any = claimed;
  try {
    if (!session.capture_type) throw new Error("tipo não escolhido");
    const { data: tm } = await db.from("team_members").select("id, nome_completo").eq("id", session.team_member_id).maybeSingle();
    const { data: ev } = session.event_id ? await db.from("smartops_events").select("id, name").eq("id", session.event_id).maybeSingle() : { data: null };
    if (!ev) throw new Error("Nenhum evento acontecendo na data do envio");
    const list = origin === "whatsapp" ? await loadItems(session.id) : await readyItems(session);
    if (!list.length) throw new Error("nada foi enviado");
    const stored = session.extracted && typeof session.extracted === "object" && "nome" in session.extracted;
    const raw: any = stored ? applyEdits(session.extracted, session.confirm_edits) : await buildLead(session, list);
    const lead = {
      ...raw, nome: String(raw.nome ?? "").trim(), email: String(raw.email ?? "").trim().toLowerCase(),
      telefone: String(raw.telefone ?? "").replace(/\D/g, ""), produtos: Array.isArray(raw.produtos) ? raw.produtos : [],
      empresa: String(raw.empresa ?? ""), resumo: String(raw.resumo ?? ""),
    };
    if (!hasContact(lead)) throw new Error("sem telefone e sem e-mail");
    const oppName = opportunityName(lead.nome, lead.empresa, lead.telefone);

    // Drive: pasta e arquivos com o nome da oportunidade
    const folderName = sanitizeFolderName(oppName);
    if (session.drive_folder_id) await driveRename(session.drive_folder_id, folderName).catch((e) => console.error("rename folder", e));
    let n = 0;
    for (const it of list) {
      if (!it.drive_file_id) continue;
      n++;
      const name = fileName(oppName, n, it.mime_type);
      await driveRename(it.drive_file_id, name).catch((e) => console.error("rename file", e));
    }

    const form = await formFor(session.capture_type, ev);
    if (!form) throw new Error(`O evento não tem formulário de ${TYPE_LABEL[session.capture_type as CaptureType]}`);
    const responses: { label: string; value: string }[] = [];
    const push = (label: string, value: unknown) => { const v = String(value ?? "").trim(); if (v) responses.push({ label, value: v.slice(0, 4000) }); };
    push("Nome", lead.nome); push("Celular", lead.telefone ? `+${lead.telefone}` : ""); push("E-mail", lead.email);
    push("Empresa", lead.empresa); push("Área de atuação", lead.area_atuacao); push("Especialidade", lead.especialidade);
    push("Endereço", lead.endereco); push("Cidade", lead.cidade); push("Estado", lead.estado); push("País", lead.pais);
    push("Produtos de interesse", lead.produtos.join(", "));
    push("Tipo de captura", TYPE_LABEL[session.capture_type as CaptureType]);
    push("Enviado por", tm?.nome_completo); push("Canal", "Captura WhatsApp Oficial");
    push("Resumo", lead.resumo);
    list.forEach((it, i) => {
      if (it.kind === "audio") push(`Transcrição do áudio ${i + 1}`, it.transcript);
      else if (it.kind === "image") push(`Texto da imagem ${i + 1}`, it.transcript);
      else if (it.kind === "text") push(`Anotação ${i + 1}`, it.text_content);
      if (it.drive_file_url) push(`Arquivo ${i + 1} (${it.kind})`, it.drive_file_url);
    });
    push("Pasta no Drive", session.drive_folder_url);

    const purpose = session.capture_type === "lead" ? "feira_evento" : session.capture_type === "kol" ? "kol_expansao" : "oportunidade_evento";
    const payload: Record<string, unknown> = {
      source: "form", form_name: form.name, form_id: form.id, form_purpose: purpose, event_id: ev.id,
      nome: lead.nome || lead.email || lead.telefone,
      ...(lead.telefone.length >= 10 ? { telefone_raw: lead.telefone } : {}),
      ...(lead.email.includes("@") ? { email: lead.email } : {}),
      ...(lead.area_atuacao ? { area_atuacao: lead.area_atuacao } : {}),
      ...(lead.especialidade ? { especialidade: lead.especialidade } : {}),
      ...(lead.empresa ? { empresa_nome: lead.empresa } : {}),
      ...(lead.cidade ? { cidade: lead.cidade } : {}), ...(lead.estado ? { uf: lead.estado } : {}),
      ...(lead.endereco ? { empresa_endereco: lead.endereco } : {}),
      ...(lead.produtos[0] ? { produto_interesse: lead.produtos[0] } : {}),
      ...(session.capture_type === "lead" && tm ? { event_consultant_team_member_id: tm.id, proprietario_lead_crm: tm.nome_completo } : {}),
      utm_source: "captura_whatsapp", utm_medium: "whatsapp_oficial", utm_campaign: ev.name,
      form_responses: responses, submission_id: session.id,
    };
    const r = await fetch(`${SUPABASE_URL}/functions/v1/smart-ops-ingest-lead`, {
      method: "POST", headers: { "Content-Type": "application/json", apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
      body: JSON.stringify(payload),
    });
    const out = await r.json().catch(() => ({}));
    if (!r.ok || !out?.lead_id) throw new Error(out?.error || `cadastro no CRM falhou (${r.status})`);
    await db.from("lead_activity_log").insert({
      lead_id: out.lead_id, event_type: "captura_whatsapp", source_channel: "whatsapp_oficial",
      entity_type: "form", entity_id: form.id, entity_name: form.name,
      event_data: { label: `Captura WhatsApp — ${TYPE_LABEL[session.capture_type as CaptureType]} (${ev.name})`, sent_by: tm?.nome_completo ?? null, team_member_id: session.team_member_id, event_id: ev.id, drive_folder_url: session.drive_folder_url, items: list.length, resumo: lead.resumo },
      dedupe_hash: `captura_whatsapp:${session.id}`,
    }).then(() => {}, () => {});
    await db.from("field_capture_sessions").update({ status: "done", confirm_step: null, extracted: lead, summary: lead.resumo, opportunity_name: oppName, lead_id: out.lead_id, result: { form_id: form.id, form_name: form.name, is_existing: !!out.is_existing } }).eq("id", session.id);
    await reply(session, `✅ ${TYPE_LABEL[session.capture_type as CaptureType]} enviado ao CRM: *${oppName}*\nOrigem: ${form.name}\nPasta: ${session.drive_folder_url ?? "-"}`);
    return { ok: true, lead_id: out.lead_id };
  } catch (e) {
    const msg = String((e as Error).message ?? e).slice(0, 500);
    await db.from("field_capture_sessions").update({ status: "error", error: msg }).eq("id", session.id);
    await reply(session, `⚠️ Não consegui concluir a captura: ${msg}. A equipe pode reprocessar pelo sistema.`);
    return { ok: false, error: msg };
  }
}

async function handleInbox(inboxId: string) {
  const { data: msg } = await db.from("whatsapp_inbox").select("id, phone, direction, instance_name, raw_payload, message_text, media_url, media_type, wa_message_id, is_group, created_at")
    .eq("id", inboxId).maybeSingle();
  if (!msg || msg.direction !== "inbound" || msg.is_group || !String(msg.instance_name ?? "").startsWith("zernio:")) return { ignored: "not_inbound" };
  const { data: tmId } = await db.rpc("fn_team_member_by_phone", { p_phone: msg.phone });
  if (!tmId) return { ignored: "not_team" };
  const p: any = msg.raw_payload ?? {};
  const accountId = String(msg.instance_name).slice("zernio:".length);
  const conversationId = String(p?.conversation?.id ?? p?.message?.conversationId ?? "") || null;
  const text = String(msg.message_text ?? "").trim();
  const cmd = msg.media_url ? null : parseCommand(text);

  let { data: session } = await db.from("field_capture_sessions").select("*").eq("team_member_id", tmId).eq("status", "collecting").maybeSingle();
  if (!session && !cmd && msg.created_at) {
    // Arquivo enviado antes do FIM mas entregue depois: pertence à captura que está sendo fechada.
    const { data: closing } = await db.from("field_capture_sessions").select("*").eq("team_member_id", tmId).eq("status", "processing")
      .lte("created_at", msg.created_at).gte("last_message_at", msg.created_at).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (closing) session = closing;
  }
  if (cmd?.kind === "cancel") {
    if (session) { await db.from("field_capture_sessions").update({ status: "cancelled" }).eq("id", session.id); await reply(session, "Captura cancelada."); }
    return { ok: true, cancelled: !!session };
  }
  if (!session && cmd?.kind !== "start") return { ignored: "no_start_word" }; // só AUTO abre captura
  if (session && cmd?.kind === "start") {
    const { count } = await db.from("field_capture_items").select("id", { count: "exact", head: true }).eq("session_id", session.id).neq("kind", "text");
    const n = count ?? 0;
    await reply(session, session.capture_type
      ? `Você já tem uma captura aberta (*${TYPE_LABEL[session.capture_type as CaptureType]}*) com ${n} arquivo${n === 1 ? "" : "s"}.\n\nMande *FIM* para conferir os dados e criar o lead, ou *CANCELAR* para descartar e começar de novo com *AUTO*.`
      : `Você já tem uma captura aberta.\n\n${MENU}`);
    return { ok: true, already_open: true };
  }
  if (!session) {
    const ev = await todayEvent();
    const { data: created, error } = await db.from("field_capture_sessions").insert({
      team_member_id: tmId, sender_phone: msg.phone, account_id: accountId, conversation_id: conversationId,
      event_id: ev?.id ?? null, capture_type: cmd?.kind === "type" ? cmd.type : null,
    }).select("*").single();
    if (error) { // corrida: outra mensagem criou a sessão
      ({ data: session } = await db.from("field_capture_sessions").select("*").eq("team_member_id", tmId).eq("status", "collecting").maybeSingle());
      if (!session) throw error;
    } else {
      session = created;
      await reply(session, `📥 Captura iniciada${ev ? ` — evento *${ev.name}*` : " — ⚠️ nenhum evento acontecendo hoje"}.${session.capture_type ? ` Tipo: *${TYPE_LABEL[session.capture_type as CaptureType]}*. Mande os arquivos e termine com *FIM*.` : `\n\n${MENU}`}`);
    }
    if (cmd?.kind === "start") return { ok: true, started: session.id }; // AUTO não vira anotação
  }
  if (conversationId && session.conversation_id !== conversationId) await db.from("field_capture_sessions").update({ conversation_id: conversationId }).eq("id", session.id);
  session.last_message_at = new Date().toISOString();
  await db.from("field_capture_sessions").update({ last_message_at: session.last_message_at }).eq("id", session.id);

  // Conferência em andamento: números são opções do menu (não tipo de captura). Arquivo novo reabre a leitura.
  if (session.confirm_step && session.status === "collecting") {
    if (msg.media_url) {
      await db.from("field_capture_sessions").update({ confirm_step: null }).eq("id", session.id);
      session.confirm_step = null;
      await reply(session, "📎 Arquivo adicionado. Mande *FIM* para eu ler de novo e você conferir os dados.");
    } else if (cmd?.kind !== "end") {
      return await handleConfirm(session, text);
    }
  }

  if (cmd?.kind === "type") {
    if (session.capture_type !== cmd.type) {
      await db.from("field_capture_sessions").update({ capture_type: cmd.type }).eq("id", session.id);
      await reply(session, `Tipo: *${TYPE_LABEL[cmd.type]}*. Mande os arquivos e termine com *FIM*.`);
    }
    return { ok: true, type: cmd.type };
  }
  if (cmd?.kind === "end") {
    if (!session.capture_type) { await reply(session, `Antes de finalizar, escolha o tipo.\n${MENU}`); return { ok: true, waiting_type: true }; }
    await reply(session, "⏳ Recebido. Lendo o material para você conferir…");
    return await prepareConfirmation(session);
  }

  // Conteúdo
  const kind = msg.media_url ? (String(msg.media_type ?? "").split("/")[0] || "document") : "text";
  const { data: item, error: itemErr } = await db.from("field_capture_items").insert({
    session_id: session.id, inbox_id: msg.id, wa_message_id: msg.wa_message_id || msg.id, kind,
    text_content: kind === "text" ? text.slice(0, 8000) : (text || null),
  }).select("id").single();
  if (itemErr) return { ignored: "duplicate" };
  if (kind === "text") return { ok: true, item: item.id };

  const media = await downloadMedia(msg.media_url!);
  if (!media) { await db.from("field_capture_items").update({ error: "download falhou" }).eq("id", item.id); await reply(session, "⚠️ Não consegui baixar um dos arquivos. Reenvie, por favor."); return { ok: false }; }
  const mime = media.mime || String(msg.media_type ?? "") || "application/octet-stream";
  const upd: Record<string, unknown> = { mime_type: mime };
  try {
    if (!session.event_id) throw new Error("sem evento hoje");
    const folder = await sessionFolder(session);
    const token = await getDriveAccessToken();
    const fid = await driveUploadFile({ token, folderId: folder, name: fileName(`captura-${session.id.slice(0, 8)}`, Date.now() % 100000, mime), content: media.bytes, mimeType: mime });
    upd.drive_file_id = fid; upd.drive_file_url = await driveGetWebViewLink(token, fid);
  } catch (e) { upd.error = `Drive: ${String((e as Error).message).slice(0, 300)}`; }
  try { upd.transcript = await readMedia(kind, media.bytes, mime) || null; }
  catch (e) { upd.error = `${upd.error ? upd.error + " | " : ""}IA: ${String((e as Error).message).slice(0, 300)}`; }
  await db.from("field_capture_items").update(upd).eq("id", item.id);
  // Retorno a cada arquivo: o vendedor sabe que foi recebido e que precisa mandar FIM.
  const what = kind === "image" ? (upd.transcript ? "📸 Foto recebida e lida." : "📸 Foto recebida (sem texto legível).")
    : kind === "audio" ? (upd.transcript ? "🎤 Áudio recebido e transcrito." : "🎤 Áudio recebido (não consegui transcrever).")
    : kind === "video" ? "🎬 Vídeo recebido." : "📎 Arquivo recebido.";
  await reply(session, `${what}${session.capture_type ? "" : `\n\n${MENU}`}\nMande mais arquivos ou *FIM* para conferir os dados.`);
  return { ok: true, item: item.id };
}

async function isStaff(req: Request): Promise<boolean> {
  const auth = req.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return false;
  const user = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
  const { data: u } = await user.auth.getUser();
  if (!u?.user) return false;
  const { data } = await db.rpc("fn_is_internal_staff", { _user_id: u.user.id }).then((r) => r, () => ({ data: false }));
  return !!data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  let body: any = {};
  try { body = await req.json(); } catch { /* */ }
  try {
    if (body?.action === "reprocess") {
      if (!(await isStaff(req))) return json({ error: "unauthorized" }, 401);
      if (!UUID_RE.test(String(body.session_id ?? ""))) return json({ error: "session_id inválido" }, 400);
      return json(await finalizeSession(body.session_id, "reprocess"));
    }
    const inboxId = String(body?.inbox_id ?? "");
    if (!UUID_RE.test(inboxId)) return json({ error: "inbox_id inválido" }, 400);
    return json(await handleInbox(inboxId));
  } catch (e) {
    console.error("[wa-field-capture]", e);
    return json({ error: "internal" }, 500);
  }
});
