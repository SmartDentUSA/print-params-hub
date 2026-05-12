---
name: PipeRun Person contact enrichment on update
description: updatePersonFields MUST re-publish canonical email + phone every PUT — Piperun's native Meta integration leaves emails[]/phones[] empty
type: feature
---
**Rule:** `smart-ops-lia-assign/index.ts → updatePersonFields` and `_shared/piperun-hierarchy.ts → updatePersonFields` MUST include `emails: [{email}]` (when `lead.email` passes `isFakeEmail`) and `phones: [{phone}]` (when `telefone_normalized`/`telefone_raw` present) on every PUT to `/persons/{id}`.

**Why:** Piperun's native Meta Lead Ads integration creates Persons with `emails[]` / `phones[]` empty (data sits only in custom_fields / payload). Without re-publishing on every CDP-side PUT the Person card stays blank forever, even after our `lia-assign` runs N times. Discovered 2026-05-12 — Heitor Rabeti, Viviane Costa Rodrigues, Gustavo Egami and ~390 other leads from 2026-05-09→12 had Persons with no email/phone visible while CDP held both.

**Backfill:** `piperun-person-contact-backfill` edge function repushes contact for any canonical lead with `pessoa_piperun_id NOT NULL`. Logged via `system_health_logs.error_type='piperun_person_contact_backfilled'`.
