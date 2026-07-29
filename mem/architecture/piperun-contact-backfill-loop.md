---
name: PipeRun contact backfill loop guard
description: retry-failed-leads safety-net must dedup by system_health_logs.lead_id column (not details.lead_id) and quarantine silently-rejected leads
type: constraint
---
**Bug (2026-07-29):** `smart-ops-piperun-retry-failed-leads` safety-net built its "already handled" set from `system_health_logs.details.lead_id`, a key those rows never carry (id lives in the `lead_id` COLUMN). Set was always empty → the same ~148 leads were re-sent to `piperun-person-contact-backfill` every 15 min, generating ~4.7k `piperun_person_contact_backfilled` + ~4.2k `piperun_email_silently_rejected` rows/24h (63% of all log volume). Same class as the `backfill_activity_identity` loop.

**Rules:**
1. Any "already processed" dedup against `system_health_logs` MUST read the `lead_id` column.
2. Leads logged with `piperun_email_silently_rejected`, `piperun_contact_still_missing_after_resync` or `piperun_person_contact_backfill_failed` in the window are QUARANTINED — never re-queued by the safety-net.
3. `missing_email` in resolver logs never meant "lead has no email" — it means the PipeRun card lacks it after the PUT. Renamed to `email_missing_on_piperun_card` / `phone_missing_on_piperun_card`.
