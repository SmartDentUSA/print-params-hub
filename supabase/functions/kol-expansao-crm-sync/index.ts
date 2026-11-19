// Formulário "Interessados em ser KOL" do evento (form_purpose = kol_expansao)
// → funil PipeRun KOL Expansão (109840), etapa "Interesse", dona Beatriz (104356),
// origem "[KOLEXPANSÃO] - {evento}" e produto de interesse pela resposta de participação.
// Chamado só pelo smart-ops-ingest-lead (service role). Nunca passa pela Golden Rule
// de Vendas e não toca em deals de outros funis. Deal aberto no mesmo funil é
// reaproveitado (só recebe nota) para não duplicar.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import {
  piperunGet, piperunPost, piperunPut, addDealNote, normalizePipeRunDealStatus,
  customFieldsToDealPayload, DEAL_CUSTOM_FIELDS,
} from "../_shared/piperun-field-map.ts";
import { findPersonByContact, validateCachedPerson, isValidEmailTld } from "../_shared/piperun-person-resolver.ts";
import {
  KOL_EXPANSION_OWNER_PIPERUN_ID as OWNER_ID, KOL_EXPANSION_PIPELINE_ID as PIPELINE_ID,
  KOL_EXPANSION_PARTICIPATION_FIELD, kolExpansionInterest, kolExpansionOrigin, kolExpansionStageId,
} from "../_shared/kol-expansion.ts";

const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(Deno.env.get("SUPABASE_URL")!, SERVICE_KEY, { auth: { persistSession: false } });
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const digits = (s: unknown) => String(s ?? "").replace(/\D/g, "");
const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function resolveOriginId(token: string, name: string): Promise<number | null> {
  const r = await piperunGet(token, "origins", { name, show: 10 }).catch(() => null);
  const items = ((r?.data as any)?.data ?? []) as any[];
  const exact = items.find((o) => String(o.name ?? "").trim().toLowerCase() === name.toLowerCase());
  if (exact?.id) return Number(exact.id);
  const c = await piperunPost(token, "origins", { name, active: true, description: "Formulário de interessados em KOL do evento" }).catch(() => null);
  return Number((c?.data as any)?.data?.id ?? 0) || null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const bearer = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!bearer || bearer !== SERVICE_KEY) return json({ error: "unauthorized" }, 401);

  try {
    const body = await req.json().catch(() => ({}));
    const leadId = String(body?.lead_id ?? "");
    const formId = String(body?.form_id ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(leadId)) return json({ error: "lead_id inválido" }, 400);
    if (!/^[0-9a-f-]{36}$/i.test(formId)) return json({ error: "form_id inválido" }, 400);
    const responses = Array.isArray(body?.form_responses) ? body.form_responses.slice(0, 60) : [];
    const customFields = (body?.custom_fields && typeof body.custom_fields === "object") ? body.custom_fields : {};

    const token = Deno.env.get("PIPERUN_API_KEY");
    if (!token) return json({ error: "PIPERUN_API_KEY ausente" }, 500);

    const { data: form } = await admin.from("smartops_forms").select("id, name, event_id, form_purpose").eq("id", formId).maybeSingle();
    if (!form || form.form_purpose !== "kol_expansao") return json({ error: "formulário não é de KOL" }, 400);
    let eventName: string | null = null;
    if (form.event_id) {
      const { data: ev } = await admin.from("smartops_events").select("name").eq("id", form.event_id).maybeSingle();
      eventName = ev?.name ?? null;
    }
    const origin = kolExpansionOrigin(eventName);
    const participation = customFields[KOL_EXPANSION_PARTICIPATION_FIELD] ??
      responses.find((r: any) => /como voc[eê] gostaria de participar/i.test(String(r?.label ?? "")))?.value;
    const interest = kolExpansionInterest(participation);

    const { data: lead } = await admin.from("lia_attendances")
      .select("id, nome, email, telefone_normalized, telefone_raw, pessoa_piperun_id, piperun_pipeline_id")
      .eq("id", leadId).is("merged_into", null).maybeSingle();
    if (!lead) return json({ error: "lead não encontrado" }, 404);

    const nome = String(lead.nome ?? "").trim();
    const email = String(lead.email ?? "").trim().toLowerCase();
    const phone = String(lead.telefone_normalized || lead.telefone_raw || "").trim();
    const phoneOk = digits(phone).length >= 10;
    const emailOk = email.includes("@") && !email.endsWith("@no-email.com") && isValidEmailTld(email);

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
      const originId = await resolveOriginId(token, origin);
      if (originId) p.origin_id = originId;
      const created = await piperunPost(token, "persons", p);
      personId = Number((created.data as any)?.data?.id ?? 0);
      if (!personId) return json({ ok: false, error: "falha ao criar pessoa" }, 502);
    }

    // Deal no funil KOL Expansão (reaproveita aberto)
    const existing = await piperunGet(token, "deals", { person_id: personId, pipeline_id: PIPELINE_ID, show: 50 });
    const open = (((existing.data as any)?.data ?? []) as any[])
      .find((d) => Number(d.pipeline_id) === PIPELINE_ID && !d.deleted && normalizePipeRunDealStatus(d.status) === "open");
    let dealId = open ? Number(open.id) : 0;
    let createdDeal = false;
    if (!dealId) {
      const stages = await piperunGet(token, "stages", { pipeline_id: PIPELINE_ID, show: 100 });
      const stageId = kolExpansionStageId(((stages.data as any)?.data ?? []) as any[]);
      if (!stageId) return json({ ok: false, error: `etapa Interesse do funil ${PIPELINE_ID} não encontrada` }, 502);
      const originId = await resolveOriginId(token, origin);
      const suffix = digits(phone).slice(-8);
      const payload: Record<string, unknown> = {
        title: `KOL Expansão — ${nome || email}${nome.split(/\s+/).length < 2 && suffix ? ` (${suffix})` : ""}`.slice(0, 150),
        person_id: personId, pipeline_id: PIPELINE_ID, stage_id: stageId, owner_id: OWNER_ID, user_id: OWNER_ID, deleted: 0,
      };
      if (originId) payload.origin_id = originId;
      const created = await piperunPost(token, "deals", payload);
      dealId = Number((created.data as any)?.data?.id ?? 0);
      if (!dealId) return json({ ok: false, error: `falha ao criar deal (${created.status})` }, 502);
      createdDeal = true;
    }
    if (interest) {
      const cf = customFieldsToDealPayload([{ custom_field_id: DEAL_CUSTOM_FIELDS.PRODUTO_INTERESSE, value: interest }]);
      await piperunPut(token, `deals/${dealId}`, { custom_fields: cf }).catch((e) => console.warn("[kol-expansao] produto PUT", e));
    }

    const lines = responses
      .filter((r: any) => r && r.label && r.value !== undefined && r.value !== "")
      .map((r: any) => `<b>${esc(String(r.label).slice(0, 120))}:</b> ${esc(String(r.value).slice(0, 1000))}`);
    const note = [
      `<b>🦷 Interesse em ser KOL — Chairside Print</b>`,
      `<b>Formulário:</b> ${esc(form.name)}`,
      eventName ? `<b>Evento:</b> ${esc(eventName)}` : null,
      `<b>Origem:</b> ${esc(origin)}`,
      interest ? `<b>Produto de interesse:</b> ${esc(interest)}` : null,
      ``,
      ...lines,
    ].filter((l) => l !== null).join("<br>");
    await addDealNote(token, dealId, note);

    const upd: Record<string, unknown> = { pessoa_piperun_id: personId };
    if (!lead.piperun_pipeline_id) { upd.piperun_pipeline_id = PIPELINE_ID; upd.piperun_id = String(dealId); }
    await admin.from("lia_attendances").update(upd).eq("id", leadId);

    const nowIso = new Date().toISOString();
    await admin.from("lead_activity_log").insert({
      lead_id: leadId,
      event_type: "kol_expansao_interesse",
      event_timestamp: nowIso,
      source_channel: "formulario",
      entity_type: "piperun_deal",
      entity_id: String(dealId),
      entity_name: form.name,
      event_data: {
        label: `Interesse em ser KOL${eventName ? ` (${eventName})` : ""} — deal #${dealId} no funil KOL Expansão`,
        deal_id: dealId, pipeline_id: PIPELINE_ID, owner_id: OWNER_ID, event_id: form.event_id, origin, produto_interesse: interest, created_deal: createdDeal,
      },
      dedupe_hash: `kol_expansao:${leadId}:${dealId}:${nowIso.slice(0, 16)}`,
    }).then(() => {}, () => {});

    return json({ ok: true, deal_id: dealId, person_id: personId, created_deal: createdDeal, origin, produto_interesse: interest });
  } catch (e) {
    console.error("[kol-expansao-crm-sync]", e);
    return json({ error: (e as Error).message ?? "internal_error" }, 500);
  }
});
