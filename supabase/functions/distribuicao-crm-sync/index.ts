// Distribuição → funil PipeRun "Exportação" (39047), primeira etapa ("Leads distribuição").
// Chamado só pelo smart-ops-ingest-lead (service role) quando form_purpose = "distribuicao".
// Nunca passa pela Golden Rule de Vendas: o deal vive só no funil 39047, proprietário 103060.
// Reaproveita deal aberto do mesmo funil (só acrescenta nota) para não duplicar.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { piperunGet, piperunPost, addDealNote } from "../_shared/piperun-field-map.ts";
import { findPersonByContact, validateCachedPerson, isValidEmailTld } from "../_shared/piperun-person-resolver.ts";

const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(Deno.env.get("SUPABASE_URL")!, SERVICE_KEY, { auth: { persistSession: false } });
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const PIPELINE_ID = 39047;
const OWNER_ID = 103060;
const digits = (s: unknown) => String(s ?? "").replace(/\D/g, "");
const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function firstStageId(token: string): Promise<number | null> {
  const r = await piperunGet(token, "stages", { pipeline_id: PIPELINE_ID, show: 100 });
  const list = (((r.data as any)?.data ?? []) as any[]).filter((s) => Number(s.pipeline_id) === PIPELINE_ID);
  if (!list.length) return null;
  const named = list.find((s) => /leads?\s*(de\s*)?distribui/i.test(String(s.name ?? "")));
  if (named) return Number(named.id);
  list.sort((a, b) => (Number(a.order ?? 0) - Number(b.order ?? 0)) || (Number(a.id) - Number(b.id)));
  return Number(list[0].id);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const bearer = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!bearer || bearer !== SERVICE_KEY) return json({ error: "unauthorized" }, 401);

  try {
    const body = await req.json().catch(() => ({}));
    const leadId = String(body?.lead_id ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(leadId)) return json({ error: "lead_id inválido" }, 400);
    const formName = String(body?.form_name ?? "# - Distribuição - Cadastro").slice(0, 200);
    const eventId = body?.event_id ? String(body.event_id) : null;
    const responses = Array.isArray(body?.form_responses) ? body.form_responses.slice(0, 60) : [];

    const token = Deno.env.get("PIPERUN_API_KEY");
    if (!token) return json({ error: "PIPERUN_API_KEY ausente" }, 500);

    const { data: lead } = await admin.from("lia_attendances")
      .select("id, nome, email, telefone_normalized, telefone_raw, pessoa_piperun_id, piperun_pipeline_id, empresa_razao_social, empresa_nome")
      .eq("id", leadId).is("merged_into", null).maybeSingle();
    if (!lead) return json({ error: "lead não encontrado" }, 404);

    const nome = String(lead.nome ?? "").trim();
    const email = String(lead.email ?? "").trim().toLowerCase();
    const phone = String(lead.telefone_normalized || lead.telefone_raw || "").trim();
    const phoneOk = digits(phone).length >= 10;
    const emailOk = email.includes("@") && isValidEmailTld(email);

    // Pessoa (nunca criar sem e-mail OU telefone)
    let personId = Number(lead.pessoa_piperun_id) || 0;
    if (personId && !(await validateCachedPerson(token, personId)).exists) personId = 0;
    if (!personId) {
      const found = await findPersonByContact(token, emailOk ? email : null, phoneOk ? phone : null, admin);
      if (found) personId = found.id;
    }
    if (!personId) {
      if (!emailOk && !phoneOk) {
        await admin.from("lia_attendances").update({ crm_creation_blocked: "missing_identifiers" }).eq("id", leadId);
        return json({ ok: false, error: "sem e-mail nem telefone" }, 422);
      }
      const p: Record<string, unknown> = { name: nome || email || phone, owner_id: OWNER_ID };
      if (emailOk) p.email = email;
      if (phoneOk) p.cellphone = phone;
      const created = await piperunPost(token, "persons", p);
      personId = Number((created.data as any)?.data?.id ?? 0);
      if (!personId) return json({ ok: false, error: "falha ao criar pessoa" }, 502);
    }

    // Deal no funil 39047 (reaproveita aberto)
    const existing = await piperunGet(token, "deals", { person_id: personId, pipeline_id: PIPELINE_ID, show: 50 });
    const open = (((existing.data as any)?.data ?? []) as any[])
      .find((d) => Number(d.pipeline_id) === PIPELINE_ID && Number(d.status) === 0);
    let dealId = open ? Number(open.id) : 0;
    let createdDeal = false;
    if (!dealId) {
      const stageId = await firstStageId(token);
      if (!stageId) return json({ ok: false, error: "etapa inicial do funil 39047 não encontrada" }, 502);
      const company = String(lead.empresa_nome || lead.empresa_razao_social || "").trim();
      const created = await piperunPost(token, "deals", {
        title: `Distribuidor — ${company || nome}`.slice(0, 150),
        person_id: personId,
        pipeline_id: PIPELINE_ID,
        stage_id: stageId,
        user_id: OWNER_ID,
      });
      dealId = Number((created.data as any)?.data?.id ?? 0);
      if (!dealId) return json({ ok: false, error: "falha ao criar deal" }, 502);
      createdDeal = true;
    }

    let eventName: string | null = null;
    if (eventId) {
      const { data: ev } = await admin.from("smartops_events").select("name").eq("id", eventId).maybeSingle();
      eventName = ev?.name ?? null;
    }
    const lines = responses
      .filter((r: any) => r && r.label && r.value !== undefined && r.value !== "")
      .map((r: any) => `<b>${esc(String(r.label).slice(0, 120))}:</b> ${esc(String(r.value).slice(0, 1000))}`);
    const note = [
      `<b>📦 Cadastro de Distribuidor — Smart Dent</b>`,
      `<b>Formulário:</b> ${esc(formName)}`,
      eventName ? `<b>Evento:</b> ${esc(eventName)}` : null,
      ``,
      ...lines,
    ].filter((l) => l !== null).join("<br>");
    await addDealNote(token, dealId, note);

    const upd: Record<string, unknown> = { pessoa_piperun_id: personId, proprietario_lead_crm: "Fábio Rinaldi" };
    if (!lead.piperun_pipeline_id) { upd.piperun_pipeline_id = PIPELINE_ID; upd.piperun_id = String(dealId); }
    await admin.from("lia_attendances").update(upd).eq("id", leadId);

    const nowIso = new Date().toISOString();
    await admin.from("lead_activity_log").insert({
      lead_id: leadId,
      event_type: "distribuicao_cadastro",
      event_timestamp: nowIso,
      source_channel: "formulario",
      entity_type: "piperun_deal",
      entity_id: String(dealId),
      entity_name: formName,
      event_data: {
        label: `Cadastro de distribuidor${eventName ? ` (${eventName})` : ""} — deal #${dealId} no funil Exportação`,
        deal_id: dealId, pipeline_id: PIPELINE_ID, owner_id: OWNER_ID, event_id: eventId, created_deal: createdDeal,
      },
      dedupe_hash: `distribuicao:${leadId}:${dealId}:${nowIso.slice(0, 16)}`,
    }).then(() => {}, () => {});

    return json({ ok: true, deal_id: dealId, person_id: personId, created_deal: createdDeal });
  } catch (e) {
    console.error("[distribuicao-crm-sync]", e);
    return json({ error: (e as Error).message ?? "internal_error" }, 500);
  }
});
