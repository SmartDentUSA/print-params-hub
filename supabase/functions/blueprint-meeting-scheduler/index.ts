// Blueprint Intelligence — Etapa 1.
// Quando um negócio do Funil de vendas entra em Apresentação/Visita:
// cria (uma única vez) o evento com Google Meet na agenda conectada,
// grava o link no campo 800593 do PipeRun, posta a nota de preparação e
// registra `reuniao_agendada` na timeline do lead.
// Estado/idempotência: uma linha em lead_activity_log (dedupe_hash meet:<deal>)
// que serve de trava e guarda cada passo concluído, permitindo retomar só o que falhou.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { piperunGet, piperunPut, addDealNote } from "../_shared/piperun-field-map.ts";
import {
  APRESENTACAO_STAGE_ID, MEET_LINK_FIELD_ID, VENDAS_PIPELINE_ID,
  buildDossierNote, calendarEventId, claimDecision, existingMeetLink,
  meetCodeFromUrl, pickMeetingSlot, type MeetingStatus, type Slot,
} from "./rules.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PIPERUN_API_KEY = Deno.env.get("PIPERUN_API_KEY") ?? "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") ?? "";
const GOOGLE_CALENDAR_API_KEY = Deno.env.get("GOOGLE_CALENDAR_API_KEY") ?? "";
const CAL = "https://connector-gateway.lovable.dev/google_calendar/calendar/v3";
const EVENT_TYPE = "reuniao_agendada";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

type Sb = ReturnType<typeof createClient>;
type Steps = { calendar?: boolean; piperun_field?: boolean; note?: boolean };

async function authorize(req: Request, sb: Sb): Promise<boolean> {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return false;
  if (token === SERVICE_ROLE_KEY) return true;
  const { data } = await sb.auth.getUser(token);
  if (!data?.user) return false;
  const { data: ok } = await sb.rpc("fn_is_internal_staff", { _user_id: data.user.id });
  return ok === true;
}

async function cal(path: string, init: RequestInit = {}) {
  if (!LOVABLE_API_KEY || !GOOGLE_CALENDAR_API_KEY) throw new Error("calendar_not_connected");
  const r = await fetch(`${CAL}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "X-Connection-Api-Key": GOOGLE_CALENDAR_API_KEY, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  const text = await r.text();
  let body: any = null; try { body = JSON.parse(text); } catch { body = text; }
  return { ok: r.ok, status: r.status, body };
}

function meetUrlOf(ev: any): string | null {
  const ep = ev?.conferenceData?.entryPoints?.find((e: any) => e.entryPointType === "video");
  return ep?.uri ?? ev?.hangoutLink ?? null;
}

/** Cria o evento ou reaproveita o mesmo ID determinístico (409 = já existe). */
async function ensureCalendarEvent(dealId: number, slot: Slot, summary: string, description: string, attendees: string[]) {
  const id = calendarEventId(dealId);
  const body = {
    id, summary, description,
    start: { dateTime: slot.startIso, timeZone: "America/Sao_Paulo" },
    end: { dateTime: slot.endIso, timeZone: "America/Sao_Paulo" },
    attendees: attendees.map((email) => ({ email })),
    conferenceData: { createRequest: { requestId: id, conferenceSolutionKey: { type: "hangoutsMeet" } } },
    extendedProperties: { private: { piperun_deal_id: String(dealId), source: "blueprint-meeting-scheduler" } },
  };
  // sendUpdates=none: convites por e-mail ficam desligados até decisão explícita.
  let r = await cal(`/calendars/primary/events?conferenceDataVersion=1&sendUpdates=none`, { method: "POST", body: JSON.stringify(body) });
  if (r.status === 409) r = await cal(`/calendars/primary/events/${id}`);
  if (!r.ok) throw new Error(`calendar_${r.status}: ${JSON.stringify(r.body).slice(0, 300)}`);
  let ev = r.body;
  // Conferência pode ficar "pending" por alguns segundos.
  for (let i = 0; i < 3 && !meetUrlOf(ev); i++) {
    await new Promise((res) => setTimeout(res, 1500));
    const g = await cal(`/calendars/primary/events/${id}`);
    if (g.ok) ev = g.body;
  }
  const url = meetUrlOf(ev);
  if (!url) throw new Error("meet_link_not_ready");
  return { eventId: ev.id as string, htmlLink: ev.htmlLink as string, meetUrl: url };
}

async function loadState(sb: Sb, leadId: string, dealId: number) {
  const { data } = await sb.from("lead_activity_log").select("id, event_data, updated_at")
    .eq("lead_id", leadId).eq("event_type", EVENT_TYPE).eq("dedupe_hash", `meet:${dealId}`).maybeSingle();
  return data as { id: string; event_data: any; updated_at: string } | null;
}

async function claim(sb: Sb, leadId: string, dealId: number, base: Record<string, unknown>) {
  const now = new Date().toISOString();
  const existing = await loadState(sb, leadId, dealId);
  if (!existing) {
    const { data, error } = await sb.from("lead_activity_log").insert({
      lead_id: leadId, event_type: EVENT_TYPE, event_timestamp: now,
      entity_type: "piperun_deal", entity_id: String(dealId), entity_name: "Reunião de Apresentação",
      source_channel: "blueprint", dedupe_hash: `meet:${dealId}`,
      event_data: { ...base, status: "processing", steps: {}, attempts: 1, dedupe_key: `meet:${dealId}` },
    }).select("id, event_data, updated_at").maybeSingle();
    if (data) return { row: data, decision: "take" as const };
    if (error && error.code !== "23505") throw new Error(`state_insert: ${error.message}`);
    const again = await loadState(sb, leadId, dealId); // corrida perdida
    return { row: again, decision: again ? claimDecision(again.event_data?.status, again.updated_at) === "take" ? "busy" as const : claimDecision(again.event_data?.status, again.updated_at) : "busy" as const };
  }
  const d = claimDecision(existing.event_data?.status as MeetingStatus, existing.updated_at);
  if (d !== "take") return { row: existing, decision: d };
  // Trava otimista: só assume se ninguém alterou a linha desde a leitura.
  const { data } = await sb.from("lead_activity_log")
    .update({ event_data: { ...existing.event_data, ...base, status: "processing", attempts: (existing.event_data?.attempts ?? 0) + 1 }, updated_at: now })
    .eq("id", existing.id).eq("updated_at", existing.updated_at).select("id, event_data, updated_at").maybeSingle();
  return data ? { row: data, decision: "take" as const } : { row: existing, decision: "busy" as const };
}

async function saveState(sb: Sb, id: string, eventData: Record<string, unknown>, eventTs?: string) {
  const patch: Record<string, unknown> = { event_data: eventData, updated_at: new Date().toISOString() };
  if (eventTs) patch.event_timestamp = eventTs;
  const { error } = await sb.from("lead_activity_log").update(patch).eq("id", id);
  if (error) throw new Error(`state_update: ${error.message}`);
}

async function resolveLead(sb: Sb, dealId: number, personEmail: string | null) {
  const { data: d } = await sb.from("deals").select("lead_id").eq("piperun_deal_id", String(dealId)).not("lead_id", "is", null).limit(1).maybeSingle();
  let leadId: string | null = (d as any)?.lead_id ?? null;
  if (!leadId) {
    const { data } = await sb.from("lia_attendances").select("id").eq("piperun_id", String(dealId)).is("merged_into", null).limit(1).maybeSingle();
    leadId = (data as any)?.id ?? null;
  }
  if (!leadId && personEmail) {
    const { data } = await sb.from("lia_attendances").select("id").ilike("email", personEmail).is("merged_into", null).limit(1).maybeSingle();
    leadId = (data as any)?.id ?? null;
  }
  if (!leadId) return null;
  // Segue a cadeia de mescla até a ficha canônica.
  for (let i = 0; i < 5; i++) {
    const { data } = await sb.from("lia_attendances").select("*").eq("id", leadId).maybeSingle();
    if (!data) return null;
    if (!(data as any).merged_into) return data as Record<string, unknown>;
    leadId = (data as any).merged_into;
  }
  return null;
}

async function processDeal(sb: Sb, dealId: number, source: string) {
  if (!PIPERUN_API_KEY) return { ok: false, status: "failed", error: "piperun_not_configured" };
  const dr = await piperunGet(PIPERUN_API_KEY, `deals/${dealId}`, {}, { "with[]": ["customFields", "person", "user", "origin"] });
  if (!dr.success) return { ok: false, status: "failed", error: `piperun_get_${dr.status}` };
  const deal = ((dr.data as any)?.data ?? {}) as Record<string, any>;
  const pipelineId = Number(deal.pipeline_id ?? deal.pipeline?.id);
  const stageId = Number(deal.stage_id ?? deal.stage?.id);
  if (pipelineId !== VENDAS_PIPELINE_ID || stageId !== APRESENTACAO_STAGE_ID) {
    return { ok: true, status: "skipped", reason: "not_apresentacao_visita", pipelineId, stageId };
  }
  const personEmail = deal.person?.contact_emails?.[0]?.email ?? deal.person?.emails?.[0]?.email ?? null;
  const lead = await resolveLead(sb, dealId, personEmail);
  if (!lead) return { ok: false, status: "failed", error: "lead_not_found" };
  const leadId = String(lead.id);

  const ownerId = Number(deal.user_id ?? deal.owner_id ?? deal.user?.id);
  const { data: seller } = await sb.from("team_members").select("id, nome_completo, email").eq("piperun_owner_id", ownerId).limit(1).maybeSingle();
  const sellerName = (seller as any)?.nome_completo ?? deal.user?.name ?? null;

  const base = { deal_id: dealId, lead_id: leadId, seller_team_member_id: (seller as any)?.id ?? null, seller_name: sellerName, pipeline_id: pipelineId, stage_id: stageId, trigger_source: source, fonte: "blueprint-meeting-scheduler" };
  const c = await claim(sb, leadId, dealId, base);
  if (c.decision === "busy") return { ok: true, status: "busy", reason: "concurrent_execution" };
  if (c.decision === "done") return { ok: true, status: "created", reused: true, meet_url: c.row?.event_data?.meet_url ?? null };
  const row = c.row!;
  const state: Record<string, any> = { ...row.event_data, ...base };
  const steps: Steps = { ...(state.steps ?? {}) };
  const errors: string[] = [];

  try {
    // Atividades: horário da reunião + contexto do dossiê.
    const ar = await piperunGet(PIPERUN_API_KEY, "activities", { deal_id: dealId, show: 50 });
    const acts = ((ar.data as any)?.data ?? []) as Array<Record<string, any>>;
    const slot = pickMeetingSlot(acts);

    // 1) Meet: campo 800593 já preenchido → reutiliza; senão cria (precisa horário).
    let meetUrl: string | null = state.meet_url ?? existingMeetLink(deal.customFields ?? deal.custom_fields);
    if (meetUrl && !state.meet_url) { state.meet_url = meetUrl; state.meet_reused_from_crm = true; steps.calendar = true; steps.piperun_field = true; }
    if (!meetUrl) {
      if (!slot) {
        state.status = "pending_schedule";
        state.pending_reason = "Sem reunião com data/hora no PipeRun";
        state.steps = steps;
        await saveState(sb, row.id, state);
        return { ok: true, status: "pending_schedule", lead_id: leadId };
      }
      const leadName = String(lead.nome ?? deal.person?.name ?? "Cliente");
      const product = String(lead.produto_interesse ?? lead.produto_interesse_auto ?? "").trim();
      const attendees = [(seller as any)?.email].filter((e): e is string => !!e && /@/.test(e));
      const ev = await ensureCalendarEvent(dealId, slot,
        `Apresentação Smart Dent · ${leadName}${product ? ` · ${product}` : ""}`,
        `Negócio PipeRun #${dealId}\nhttps://app.pipe.run/#/deals/${dealId}\nVendedor: ${sellerName ?? "-"}`,
        attendees);
      meetUrl = ev.meetUrl;
      Object.assign(state, { meet_url: ev.meetUrl, calendar_event_id: ev.eventId, calendar_html_link: ev.htmlLink });
      steps.calendar = true;
    }
    if (slot) Object.assign(state, { scheduled_start: slot.startIso, scheduled_end: slot.endIso, piperun_activity_id: slot.activityId });
    state.meet_code = meetCodeFromUrl(meetUrl);
    state.steps = steps;
    await saveState(sb, row.id, state, slot?.startIso);

    // 2) Campo 800593 (só esse campo é enviado).
    if (!steps.piperun_field) {
      const u = await piperunPut(PIPERUN_API_KEY, `deals/${dealId}`, { custom_fields: [{ id: MEET_LINK_FIELD_ID, value: meetUrl }] });
      if (u.success) steps.piperun_field = true; else errors.push(`piperun_field_${u.status}`);
    }

    // 3) Nota de preparação (uma vez por negócio).
    if (!steps.note) {
      const { data: hist } = await sb.from("deals").select("piperun_deal_id, pipeline_name, stage_name, status, owner_name, product, loss_reason, piperun_created_at")
        .eq("lead_id", leadId).order("piperun_created_at", { ascending: false }).limit(10);
      const note = buildDossierNote({
        lead, slot, meetUrl,
        deal: { id: dealId, title: deal.title, origin: deal.origin?.name ?? null, ownerName: sellerName, value: deal.value ?? null },
        history: (hist ?? []) as any[],
        activities: acts.map((a) => ({ title: a.title, when: a.start_at ?? a.created_at, comment: String(a.comment ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() })),
      });
      const n = await addDealNote(PIPERUN_API_KEY, dealId, note);
      if (n.success) { steps.note = true; state.note_preview = note.slice(0, 600); } else errors.push("note_failed");
    }

    state.steps = steps;
    state.status = errors.length ? "failed" : "created";
    state.last_errors = errors.length ? errors : null;
    await saveState(sb, row.id, state);
    return { ok: errors.length === 0, status: state.status, lead_id: leadId, meet_url: meetUrl, steps, errors };
  } catch (e) {
    state.steps = steps;
    state.status = "failed";
    state.last_errors = [String((e as Error).message ?? e).slice(0, 400)];
    try { await saveState(sb, row.id, state); } catch (_) { /* registro de falha não pode mascarar o erro */ }
    console.error(`[blueprint-meeting] deal=${dealId}`, state.last_errors[0]);
    return { ok: false, status: "failed", lead_id: leadId, errors: state.last_errors };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  if (!(await authorize(req, sb))) return json({ error: "unauthorized" }, 401);
  let body: any = {};
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }

  // Reprocessa estados pendentes/falhos (até 20), útil para rotina periódica.
  if (body?.mode === "retry_pending") {
    const { data } = await sb.from("lead_activity_log").select("entity_id, event_data")
      .eq("event_type", EVENT_TYPE).eq("source_channel", "blueprint")
      .in("event_data->>status", ["failed", "pending_schedule"]).order("updated_at", { ascending: true }).limit(20);
    const out = [];
    for (const r of data ?? []) out.push({ deal_id: r.entity_id, ...(await processDeal(sb, Number(r.entity_id), "retry_pending")) });
    return json({ ok: true, processed: out.length, results: out });
  }

  const dealId = Number(body?.deal_id);
  if (!Number.isInteger(dealId) || dealId <= 0) return json({ error: "deal_id inválido" }, 400);
  const res = await processDeal(sb, dealId, String(body?.source ?? "manual").slice(0, 40));
  return json(res, res.ok ? 200 : 502);
});
