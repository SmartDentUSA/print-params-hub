/**
 * Commercial intent guard — defense-in-depth.
 *
 * Determines whether a lead is eligible for being pushed to PipeRun as a Deal.
 * Astron Academy postbacks, e-commerce sync, raw WhatsApp pings, etc. must
 * NOT auto-create commercial Deals — they only become Deals when an explicit
 * commercial signal exists (form submission, paid ad lead, sales chat
 * qualification, manual import).
 *
 * Used by both `smart-ops-piperun-retry-failed-leads` (cron filter) and
 * `smart-ops-lia-assign` (last-mile guard).
 */

export const COMMERCIAL_SOURCES: ReadonlySet<string> = new Set([
  "meta_lead_ad",
  "manual_form",
  "smart_dent_form",
  "sellflux_webhook",
  "piperun_webhook",
  "dra_lia_chat_qualified",
  "csv_import_commercial",
  "wa_inbound_qualified",
  "tally_form",
  "manychat_webhook",
  "form_submission",
]);

export const NON_COMMERCIAL_SOURCES: ReadonlySet<string> = new Set([
  "astron_postback",
  "sync_astron_members",
  "ecommerce_order",
  "loja_integrada",
  "wa_inbound",
  "whatsapp_lia",
  "dra-lia",
  "dra_lia",
  "unknown",
  "system",
]);

export interface CommercialIntentLead {
  source?: string | null;
  form_name?: string | null;
  piperun_id?: string | number | null;
  empresa_cnpj?: string | null;
  crm_won?: boolean | null;
  email?: string | null;
  raw_payload?: Record<string, unknown> | null;
}

export interface CommercialIntentResult {
  eligible: boolean;
  reason: string;
}

function looksLikeInternalEmail(email?: string | null): boolean {
  if (!email) return false;
  const e = email.toLowerCase();
  return (
    e.endsWith("@smartdent.com.br") ||
    e.endsWith("@whatsapp.lead") ||
    /^wa_\d+/.test(e) ||
    /test|teste|example/.test(e)
  );
}

/**
 * Returns whether `lead` may be pushed to PipeRun as a commercial Deal.
 * `commercialOverride=true` is reserved for explicit caller intent (e.g. a
 * Dra. LIA chat session that successfully qualified the lead by collecting
 * full intent) and must NEVER be set by background jobs.
 */
export function evaluateCommercialIntent(
  lead: CommercialIntentLead,
  commercialOverride = false,
): CommercialIntentResult {
  if (commercialOverride) {
    return { eligible: true, reason: "commercial_override" };
  }

  // Already a Deal in PipeRun → updates are allowed.
  if (lead.piperun_id) {
    return { eligible: true, reason: "already_has_piperun_id" };
  }

  // Internal/test/synthetic emails are never commercial.
  if (looksLikeInternalEmail(lead.email)) {
    return { eligible: false, reason: "internal_or_synthetic_email" };
  }

  // Real form submission is the strongest commercial signal.
  if (lead.form_name && String(lead.form_name).trim().length > 0) {
    return { eligible: true, reason: "form_submission" };
  }

  // Whitelisted commercial source.
  const src = (lead.source || "").toLowerCase();
  if (COMMERCIAL_SOURCES.has(src)) {
    return { eligible: true, reason: `whitelist:${src}` };
  }

  // Explicitly non-commercial source.
  if (NON_COMMERCIAL_SOURCES.has(src)) {
    return { eligible: false, reason: `non_commercial_source:${src || "empty"}` };
  }

  // Default deny: anything we do not recognise must not auto-create a Deal.
  return { eligible: false, reason: `unrecognized_source:${src || "empty"}` };
}