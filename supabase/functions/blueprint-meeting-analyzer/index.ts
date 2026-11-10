// Blueprint Intelligence — Etapa 3.
// Depois da reunião agendada pelo blueprint-meeting-scheduler: localiza as anotações/
// transcrição do Gemini (anexo do evento ou pasta "Meet Recordings" do oráculo),
// gera o relatório (dores, objeções, próximos passos, perfil comercial, condução do
// vendedor), posta a nota no PipeRun e registra `reuniao_analisada` na timeline.
// Estado: a mesma linha `reuniao_agendada` (dedupe meet:<deal>) guarda `analysis`.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { addDealNote } from "../_shared/piperun-field-map.ts";
import { DOC_MIME, MEET_NOTES_FOLDER_ID, buildReportNote, dueState, pickNotesDoc, type Analysis, type DriveDoc } from "./rules.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PIPERUN_API_KEY = Deno.env.get("PIPERUN_API_KEY") ?? "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") ?? "";
const CAL_KEY = Deno.env.get("GOOGLE_CALENDAR_API_KEY") ?? "";
const DRIVE_KEY = Deno.env.get("GOOGLE_DRIVE_API_KEY") ?? "";
const GW = "https://connector-gateway.lovable.dev";
const MAX_TEXT = 60000;

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
type Sb = ReturnType<typeof createClient>;

async function authorize(req: Request, sb: Sb): Promise<boolean> {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return false;
  if (token === SERVICE_ROLE_KEY) return true;
  try {
    const claims = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    if (claims?.role === "service_role") {
      const { error } = await createClient(SUPABASE_URL, token).auth.admin.listUsers({ page: 1, perPage: 1 });
      return !error;
    }
  } catch (_) { /* não é JWT */ }
  const { data } = await sb.auth.getUser(token);
  if (!data?.user) return false;
  const { data: ok } = await sb.rpc("fn_is_internal_staff", { _user_id: data.user.id });
  return ok === true;
}

async function gw(connector: string, key: string, path: string): Promise<{ ok: boolean; status: number; text: string }> {
  const r = await fetch(`${GW}/${connector}${path}`, { headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "X-Connection-Api-Key": key } });
  return { ok: r.ok, status: r.status, text: await r.text() };
}

async function findDoc(eventId: string) {
  const ev = await gw("google_calendar", CAL_KEY, `/calendar/v3/calendars/primary/events/${eventId}`);
  if (!ev.ok) throw new Error(`calendar_${ev.status}: ${ev.text.slice(0, 200)}`);
  const event = JSON.parse(ev.text);
  const q = encodeURIComponent(`'${MEET_NOTES_FOLDER_ID}' in parents and mimeType='${DOC_MIME}' and trashed=false and createdTime > '${new Date(Date.now() - 4 * 86400000).toISOString()}'`);
  const fl = await gw("google_drive", DRIVE_KEY, `/drive/v3/files?q=${q}&fields=files(id,name,mimeType,createdTime,modifiedTime)&pageSize=100&supportsAllDrives=true&includeItemsFromAllDrives=true`);
  if (!fl.ok) throw new Error(`drive_list_${fl.status}: ${fl.text.slice(0, 200)}`);
  const folderDocs = (JSON.parse(fl.text).files ?? []) as DriveDoc[];
  return { doc: pickNotesDoc({ attachments: event.attachments ?? [], folderDocs, eventSummary: String(event.summary ?? "") }), summary: String(event.summary ?? "") };
}

async function exportText(fileId: string): Promise<string> {
  const r = await gw("google_drive", DRIVE_KEY, `/drive/v3/files/${fileId}/export?mimeType=text/plain`);
  if (!r.ok) throw new Error(`drive_export_${r.status}: ${r.text.slice(0, 200)}`);
  return r.text.slice(0, MAX_TEXT);
}

const S = { type: "string" } as const;
const SA = { type: "array", items: S } as const;
const SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["resumo", "dores", "objecoes", "proximos_passos", "produtos_citados", "temperatura", "perfil_comercial", "avaliacao_vendedor"],
  properties: {
    resumo: S, dores: SA, objecoes: SA, produtos_citados: SA,
    proximos_passos: { type: "array", items: { type: "object", additionalProperties: false, required: ["responsavel", "acao"], properties: { responsavel: S, acao: S } } },
    temperatura: { type: "string", enum: ["quente", "morno", "frio"] },
    perfil_comercial: { type: "object", additionalProperties: false, required: ["estilo_decisao", "prioridades", "sensibilidade_preco", "nivel_tecnico", "sinais_compra", "riscos"], properties: { estilo_decisao: S, prioridades: SA, sensibilidade_preco: S, nivel_tecnico: S, sinais_compra: SA, riscos: SA } },
    avaliacao_vendedor: { type: "object", additionalProperties: false, required: ["nota_conducao", "pontos_fortes", "melhorias", "resumo"], properties: { nota_conducao: { type: "number" }, pontos_fortes: SA, melhorias: SA, resumo: S } },
  },
};

async function analyze(text: string, ctx: { leadName: string; sellerName: string; product: string }): Promise<Analysis> {
  const prompt = `Você é analista comercial sênior da Smart Dent (odontologia digital). Analise as anotações/transcrição de uma reunião de apresentação.
Cliente: ${ctx.leadName}. Vendedor: ${ctx.sellerName}. Produto de interesse no CRM: ${ctx.product || "não informado"}.
Regras:
- Use SOMENTE o que está no texto. Não invente fatos, valores, prazos nem nomes. Se algo não aparece, diga "não identificado".
- Perfil comercial = comportamento observável na reunião (como decide, o que prioriza, sensibilidade a preço, domínio técnico). NÃO faça diagnóstico psicológico, de saúde ou de traços de personalidade sensíveis.
- Não cite preços ou valores comerciais no resumo nem no perfil.
- Avalie a condução do vendedor (descoberta de necessidades, clareza técnica, tratamento de objeções, fechamento com próximo passo) com nota 0–10.
- Português do Brasil, objetivo.

TEXTO DA REUNIÃO:
${text}`;
  const r = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": LOVABLE_API_KEY, "X-Lovable-AIG-SDK": "fetch" },
    body: JSON.stringify({
      model: "openai/gpt-6-astra", store: false, reasoning: { effort: "low" },
      input: [{ role: "user", content: [{ type: "input_text", text: prompt }] }],
      text: { format: { type: "json_schema", name: "meeting_analysis", strict: true, schema: SCHEMA } },
    }),
  });
  const body = await r.text();
  if (!r.ok) throw new Error(`ai_${r.status}: ${body.slice(0, 300)}`);
  const j = JSON.parse(body);
  const out = j.output_text ?? (j.output ?? []).flatMap((o: any) => o.content ?? []).find((c: any) => c.type === "output_text")?.text;
  if (!out) throw new Error("ai_empty_output");
  return JSON.parse(out) as Analysis;
}

async function processRow(sb: Sb, row: { id: string; lead_id: string; event_data: any }, force = false) {
  const st = row.event_data ?? {};
  const a = st.analysis ?? {};
  if (a.status === "done" && !force) return { status: "done", reused: true };
  if (!st.calendar_event_id) return { status: "skipped", reason: "no_calendar_event" };
  const due = force ? "search" : dueState(st.scheduled_start, st.scheduled_end);
  if (due === "wait") return { status: "waiting" };
  const save = async (patch: Record<string, unknown>) => {
    st.analysis = { ...a, ...patch, checked_at: new Date().toISOString(), checks: (a.checks ?? 0) + 1 };
    await sb.from("lead_activity_log").update({ event_data: st, updated_at: new Date().toISOString() }).eq("id", row.id);
  };
  const { doc, summary } = await findDoc(st.calendar_event_id);
  if (!doc) {
    if (due === "give_up") { await save({ status: "no_notes", reason: "Nenhuma anotação do Gemini encontrada em 3 dias" }); return { status: "no_notes" }; }
    await save({ status: "waiting_notes" });
    return { status: "waiting_notes", summary };
  }
  const docUrl = `https://docs.google.com/document/d/${doc.id}/edit`;
  const text = await exportText(doc.id);
  const { data: lead } = await sb.from("lia_attendances").select("nome, produto_interesse, produto_interesse_auto").eq("id", row.lead_id).maybeSingle();
  const analysis = await analyze(text, {
    leadName: String((lead as any)?.nome ?? "Cliente"), sellerName: String(st.seller_name ?? "vendedor"),
    product: String((lead as any)?.produto_interesse ?? (lead as any)?.produto_interesse_auto ?? ""),
  });
  const now = new Date().toISOString();
  // Timeline (uma por negócio).
  const { error: insErr } = await sb.from("lead_activity_log").insert({
    lead_id: row.lead_id, event_type: "reuniao_analisada", event_timestamp: now,
    entity_type: "piperun_deal", entity_id: String(st.deal_id), entity_name: "Relatório da Apresentação",
    source_channel: "blueprint", dedupe_hash: `meetanalysis:${st.deal_id}`,
    event_data: { deal_id: st.deal_id, seller_name: st.seller_name, seller_team_member_id: st.seller_team_member_id, meet_url: st.meet_url, doc_id: doc.id, doc_url: docUrl, doc_name: doc.name, found_via: doc.via, analysis, notes_text: text, fonte: "blueprint-meeting-analyzer", dedupe_key: `meetanalysis:${st.deal_id}` },
  });
  if (insErr && insErr.code !== "23505") throw new Error(`timeline: ${insErr.message}`);
  let noteOk = !!a.note_posted;
  if (!noteOk && PIPERUN_API_KEY) {
    const n = await addDealNote(PIPERUN_API_KEY, Number(st.deal_id), buildReportNote(analysis, docUrl, st.meet_url ?? null));
    noteOk = n.success;
  }
  await save({ status: noteOk ? "done" : "failed", doc_id: doc.id, doc_url: docUrl, note_posted: noteOk, temperatura: analysis.temperatura, nota_conducao: analysis.avaliacao_vendedor?.nota_conducao ?? null, last_error: noteOk ? null : "note_failed" });
  return { status: noteOk ? "done" : "failed", doc: doc.name, via: doc.via };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  let body: any = {};
  try { body = await req.json(); } catch { body = {}; }
  // Varredura sem parâmetros (rotina periódica) é pública e idempotente: só processa reuniões
  // vencidas e devolve apenas contagens. Escolher negócio ou forçar exige serviço/equipe.
  const wantsTarget = body?.deal_id != null || body?.force;
  const authed = await authorize(req, sb);
  if (wantsTarget && !authed) return json({ error: "unauthorized" }, 401);
  if (!LOVABLE_API_KEY || !CAL_KEY || !DRIVE_KEY) return json({ error: "connectors_not_configured" }, 500);

  let q = sb.from("lead_activity_log").select("id, lead_id, event_data")
    .eq("event_type", "reuniao_agendada").eq("source_channel", "blueprint").eq("event_data->>status", "created");
  const dealId = Number(body?.deal_id);
  if (Number.isInteger(dealId) && dealId > 0) q = q.eq("entity_id", String(dealId));
  else q = q.gte("event_timestamp", new Date(Date.now() - 4 * 86400000).toISOString()).lte("event_timestamp", new Date().toISOString());
  const { data, error } = await q.order("event_timestamp", { ascending: true }).limit(15);
  if (error) return json({ error: error.message }, 500);

  const results = [];
  for (const r of data ?? []) {
    if ((r as any).event_data?.analysis?.status === "done" || (r as any).event_data?.analysis?.status === "no_notes") { if (!body?.force) continue; }
    try { results.push({ deal_id: (r as any).event_data?.deal_id, ...(await processRow(sb, r as any, !!body?.force)) }); }
    catch (e) {
      const msg = String((e as Error).message ?? e).slice(0, 400);
      console.error("[blueprint-analyzer]", (r as any).event_data?.deal_id, msg);
      results.push({ deal_id: (r as any).event_data?.deal_id, status: "error", error: msg });
    }
  }
  if (!authed) return json({ ok: true, processed: results.length, done: results.filter((r: any) => r.status === "done").length });
  return json({ ok: true, processed: results.length, results });
});
