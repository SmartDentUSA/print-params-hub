
## Meta-cron duplicate Person prevention (2026-05-13)
- `smart-ops-ingest-lead` HARD_DEDUPE: short-circuits when `lia_attendances.platform_lead_id = meta_leadgen_id` already exists (canonical only). Runs before the 6h activity-log dedupe.
- `smart-ops-lia-assign:createPerson` debounce extended: name+source (60s) PLUS email (any source, 60s) PLUS phone (any source, 60s). Uses `updated_at` to also catch re-enrichments.
- Both `ingest-lead` and `lia-assign` already follow `merged_into` chain to canonical, so secondary lead invocations never create new Persons.
---
name: Commercial Intent Guard for PipeRun Deal Creation
description: Astron Academy/e-commerce/raw WA leads must NEVER auto-create PipeRun Deals; lia-assign + retry-cron enforce via shared isCommercialSource()
type: constraint
---
PipeRun Deal creation is restricted to leads with explicit commercial intent.

**Policy:** A lead may only become a PipeRun Deal if it satisfies one of:
- `form_name` is non-empty (real form submission)
- `source` ∈ COMMERCIAL_SOURCES (meta_lead_ad, manual_form, smart_dent_form, sellflux_webhook, piperun_webhook, dra_lia_chat_qualified, csv_import_commercial, wa_inbound_qualified, tally_form, manychat_webhook, form_submission)
- already has a `piperun_id` (updates allowed)
- caller passes explicit `commercial_override: true` (reserved for qualified chat flows)

**Blocked sources (default deny):** astron_postback, sync_astron_members, ecommerce_order, loja_integrada, wa_inbound, whatsapp_lia, dra-lia, internal `@smartdent.com.br` and synthetic `wa_*@whatsapp.lead` emails.

**Implementation:** `supabase/functions/_shared/commercial-intent.ts` exports `evaluateCommercialIntent(lead, override)`. Two enforcement points:
1. `smart-ops-piperun-retry-failed-leads` filters before invoking lia-assign and burns down skipped leads with `raw_payload.piperun_retry_attempts=999` + `piperun_retry_skipped_reason`.
2. `smart-ops-lia-assign` rejects with HTTP 409 + sets `crm_creation_blocked=true` + logs `lia_assign_blocked_non_commercial`.

**Why:** On 2026-05-11 the retry-cron pushed 17 non-commercial leads (Bruna Mascarenhas Astron student, Smart Dent employees, e-commerce-only buyers, raw WA pings) into PipeRun, polluting the CRM and triggering misleading WhatsApp seller notifications with all-N/A fields.

**Funil + Status Guard (2026-05-13):** Dedupe by cached `piperun_id` only preserves the existing Deal if **alive AND open (status===0) AND in `PIPELINES.VENDAS`**. Any of the following force creation of a NEW Deal in Vendas:
- Deal closed (status≠0 → won/lost/cancel) — even if in Vendas
- Deal alive+open in CS / Suporte / Treinamento / Distribuidor / any non-Vendas pipeline (logged `[lia-assign] FUNIL GUARD:`)
- Deal deleted/dead

Rationale: a lead engaging again must always have an OPEN commercial opportunity in Vendas. Closed deals (lost/won) and post-sale/training pipelines never satisfy dedupe.
