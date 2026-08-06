/**
 * Stripe ↔ CDP reconciliation ("mesh")
 * ------------------------------------
 * Um checkout Stripe muitas vezes chega antes do cadastro definitivo no CRM:
 * o comprador usa um e-mail financeiro/novo telefone e o webhook acaba criando
 * um lead-stub (`source = stripe_checkout`) ou casando num registro placeholder
 * antigo. Quando o PipeRun depois atualiza/cria o cadastro canônico (com CNPJ,
 * e-mail e telefone reais), este módulo faz o "mesh":
 *
 *   1. procura pagamentos Stripe cujos identificadores casam com o lead canônico
 *   2. reaponta `stripe_webhook_events`, `stripe_payment_units` e os eventos de
 *      timeline (`lead_activity_log`) para o lead canônico
 *   3. funde o lead-stub (merged_into = canônico) — SOMENTE quando ele é
 *      claramente um stub (sem piperun_id, e-mail placeholder ou origem
 *      stripe_checkout) — limpando identificadores para não recasar
 *
 * Nunca lança: qualquer falha é logada em `system_health_logs`.
 */
// deno-lint-ignore-file no-explicit-any
import { normalizeBrazilianPhone } from "./phone-normalize.ts";
import { isRealEmail } from "./email-sanitize.ts";

type SupabaseLike = any;

const LOOKBACK_DAYS = 365;
const MAX_EVENTS = 800;

export interface StripeIdentifiers {
  emails: string[];
  phones: string[]; // dígitos (com DDI quando houver)
  cnpjs: string[];
  cpfs: string[];
}

function digits(v: string | null | undefined): string {
  return String(v ?? "").replace(/\D/g, "");
}

function phoneKeys(raw: string | null | undefined): string[] {
  const out = new Set<string>();
  const d = digits(raw);
  if (d.length >= 10) {
    out.add(d);
    const normalized = digits(normalizeBrazilianPhone(raw ?? undefined) ?? "");
    if (normalized.length >= 10) out.add(normalized);
    // últimos 8 dígitos: chave tolerante ao 9º dígito / DDI
    out.add(d.slice(-8));
  }
  return [...out].filter(Boolean);
}

export function emptyIdentifiers(): StripeIdentifiers {
  return { emails: [], phones: [], cnpjs: [], cpfs: [] };
}

/** Extrai identificadores do payload de um evento Stripe. */
export function identifiersFromStripePayload(payload: any): StripeIdentifiers {
  const obj = payload?.data?.object ?? payload ?? {};
  const emails = [
    obj?.customer_details?.email,
    obj?.billing_details?.email,
    obj?.charges?.data?.[0]?.billing_details?.email,
    obj?.customer_email,
    obj?.receipt_email,
    obj?.metadata?.email,
  ].filter((e: any) => isRealEmail(e)).map((e: string) => e.toLowerCase().trim());

  const phones = [
    obj?.customer_details?.phone,
    obj?.billing_details?.phone,
    obj?.charges?.data?.[0]?.billing_details?.phone,
    obj?.customer_phone,
    obj?.metadata?.phone,
  ].flatMap((p: any) => phoneKeys(p));

  const taxIds: string[] = [
    ...(Array.isArray(obj?.customer_details?.tax_ids) ? obj.customer_details.tax_ids.map((t: any) => t?.value) : []),
    obj?.metadata?.cnpj,
    obj?.metadata?.cpf,
    obj?.metadata?.tax_id,
  ].filter(Boolean).map((v: any) => digits(v));

  return {
    emails: [...new Set(emails)],
    phones: [...new Set(phones)],
    cnpjs: [...new Set(taxIds.filter((v) => v.length === 14))],
    cpfs: [...new Set(taxIds.filter((v) => v.length === 11))],
  };
}

/** Identificadores do lead canônico (linha de lia_attendances). */
export function identifiersFromLead(lead: any, extra?: Partial<StripeIdentifiers>): StripeIdentifiers {
  const emails = [lead?.email, ...(Array.isArray(lead?.email_secundarios) ? lead.email_secundarios : [])]
    .filter((e: any) => isRealEmail(e))
    .map((e: string) => String(e).toLowerCase().trim());
  const phones = [lead?.telefone_normalized, lead?.telefone_raw, lead?.wa_phone].flatMap((p: any) => phoneKeys(p));
  const cnpjs = [lead?.empresa_cnpj].map((v: any) => digits(v)).filter((v) => v.length === 14);
  const cpfs = [lead?.pessoa_cpf].map((v: any) => digits(v)).filter((v) => v.length === 11);
  return {
    emails: [...new Set([...emails, ...(extra?.emails ?? [])])],
    phones: [...new Set([...phones, ...(extra?.phones ?? [])])],
    cnpjs: [...new Set([...cnpjs, ...(extra?.cnpjs ?? [])])],
    cpfs: [...new Set([...cpfs, ...(extra?.cpfs ?? [])])],
  };
}

function overlap(a: StripeIdentifiers, b: StripeIdentifiers): { hit: boolean; by: string | null } {
  if (a.cnpjs.some((v) => b.cnpjs.includes(v))) return { hit: true, by: "cnpj" };
  if (a.cpfs.some((v) => b.cpfs.includes(v))) return { hit: true, by: "cpf" };
  if (a.emails.some((v) => b.emails.includes(v))) return { hit: true, by: "email" };
  if (a.phones.some((v) => b.phones.includes(v))) return { hit: true, by: "phone" };
  return { hit: false, by: null };
}

async function log(supabase: SupabaseLike, severity: string, error_type: string, lead_id: string | null, details: Record<string, unknown>) {
  try {
    await supabase.from("system_health_logs").insert({
      function_name: "stripe-lead-reconcile",
      severity,
      error_type,
      lead_id,
      details,
    });
  } catch (_) { /* never break the caller */ }
}

/** true quando o lead é um stub seguro para fundir no canônico. */
function isStubLead(lead: any): boolean {
  if (!lead) return false;
  if (lead.piperun_id) return false;
  if (lead.pessoa_piperun_id) return false;
  const placeholderEmail = !isRealEmail(lead.email);
  const stripeOrigin = String(lead.source ?? "").toLowerCase().includes("stripe");
  return placeholderEmail || stripeOrigin;
}

export interface ReconcileResult {
  relinked_events: number;
  relinked_units: number;
  relinked_activities: number;
  merged_leads: string[];
  matched_by: string[];
}

/**
 * Faz o mesh dos pagamentos Stripe com o lead canônico informado.
 * Chamado pelo webhook do PipeRun (após criar/atualizar o lead) e pelo próprio
 * stripe-webhook (para casos em que o cadastro já existia).
 */
export async function reconcileStripeToLead(
  supabase: SupabaseLike,
  canonicalLeadId: string,
  opts?: { extra?: Partial<StripeIdentifiers>; source?: string },
): Promise<ReconcileResult> {
  const result: ReconcileResult = {
    relinked_events: 0,
    relinked_units: 0,
    relinked_activities: 0,
    merged_leads: [],
    matched_by: [],
  };

  try {
    const { data: lead } = await supabase
      .from("lia_attendances")
      .select("id, merged_into, email, email_secundarios, telefone_normalized, telefone_raw, wa_phone, empresa_cnpj, pessoa_cpf")
      .eq("id", canonicalLeadId)
      .maybeSingle();
    if (!lead) return result;
    // nunca reaponta para um registro já fundido
    const targetId: string = (lead as any).merged_into ?? (lead as any).id;

    const leadIds = identifiersFromLead(lead, opts?.extra);
    if (!leadIds.emails.length && !leadIds.phones.length && !leadIds.cnpjs.length && !leadIds.cpfs.length) {
      return result;
    }

    const since = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000).toISOString();
    const { data: events } = await supabase
      .from("stripe_webhook_events")
      .select("event_id, lead_id, payload, processed_at")
      .gte("processed_at", since)
      .order("processed_at", { ascending: false })
      .limit(MAX_EVENTS);

    const matches: Array<{ event_id: string; old_lead_id: string | null; by: string }> = [];
    for (const ev of (events ?? []) as any[]) {
      if (ev.lead_id === targetId) continue;
      const evIds = identifiersFromStripePayload(ev.payload);
      const { hit, by } = overlap(leadIds, evIds);
      if (hit) matches.push({ event_id: ev.event_id, old_lead_id: ev.lead_id ?? null, by: by! });
    }
    if (!matches.length) return result;

    const eventIds = matches.map((m) => m.event_id);
    result.matched_by = [...new Set(matches.map((m) => m.by))];

    // 1) eventos Stripe
    const { error: evErr, count: evCount } = await supabase
      .from("stripe_webhook_events")
      .update({ lead_id: targetId }, { count: "exact" })
      .in("event_id", eventIds);
    if (!evErr) result.relinked_events = evCount ?? eventIds.length;

    // 2) unidades de pagamento (RMS)
    const { error: unErr, count: unCount } = await supabase
      .from("stripe_payment_units")
      .update({ lead_id: targetId }, { count: "exact" })
      .in("stripe_event_id", eventIds);
    if (!unErr) result.relinked_units = unCount ?? 0;

    // 3) timeline
    for (const evId of eventIds) {
      const { error: aErr, count: aCount } = await supabase
        .from("lead_activity_log")
        .update({ lead_id: targetId }, { count: "exact" })
        .eq("source_channel", "stripe")
        .eq("event_data->>stripe_event_id", evId)
        .neq("lead_id", targetId);
      if (!aErr) result.relinked_activities += aCount ?? 0;
    }

    // 4) funde stubs que ficaram órfãos
    const oldLeadIds = [...new Set(matches.map((m) => m.old_lead_id).filter((v): v is string => !!v && v !== targetId))];
    for (const oldId of oldLeadIds) {
      const { data: oldLead } = await supabase
        .from("lia_attendances")
        .select("id, nome, email, source, piperun_id, pessoa_piperun_id, merged_into")
        .eq("id", oldId)
        .maybeSingle();
      if (!oldLead || (oldLead as any).merged_into) continue;
      if (!isStubLead(oldLead)) {
        await log(supabase, "warning", "stripe_mesh_stub_not_merged", oldId, {
          canonical_id: targetId,
          reason: "lead com identidade própria (piperun_id ou e-mail real)",
          source: opts?.source ?? null,
        });
        continue;
      }
      const { error: mergeErr } = await supabase
        .from("lia_attendances")
        .update({
          merged_into: targetId,
          telefone_normalized: null,
          wa_phone: null,
          lead_status: "merged",
        })
        .eq("id", oldId);
      if (!mergeErr) result.merged_leads.push(oldId);
    }

    await log(supabase, "info", "stripe_mesh_reconciled", targetId, {
      ...result,
      event_ids: eventIds.slice(0, 20),
      source: opts?.source ?? null,
    });
  } catch (e) {
    await log(supabase, "error", "stripe_mesh_failed", canonicalLeadId, {
      message: (e as Error)?.message?.slice(0, 400) ?? String(e),
      source: opts?.source ?? null,
    });
  }

  return result;
}
