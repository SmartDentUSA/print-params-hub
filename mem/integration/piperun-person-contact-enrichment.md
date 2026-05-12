---
name: PipeRun Person contact enrichment on update
description: updatePersonFields/findOrCreateCompany MUST re-publish full Person + Company contact every PUT, plus a post-Deal verify step in lia-assign
type: feature
---
**Rule:** `smart-ops-lia-assign/index.ts → updatePersonFields` MUST send the full Person payload — `name`, `emails:[{email}]` (when `lead.email` passes `isFakeEmail`), `phones:[{phone}]` + `cellphone` (when `telefone_normalized`/`telefone_raw` present), `job_title` (cascade `especialidade → area_atuacao → pessoa_cargo`), `cpf`, `birth_date`, `gender`, `linkedin`, `facebook`, `observation`. If the full PUT fails (any single field rejected), retry with a minimal `{name, emails, phones}` payload so the card never loses contact. Custom field IDs 674001/674002 stay disabled.

`findOrCreateCompany` MUST always send `emails:[{email}]` and `phones:[{phone}]` (lead's email/phone as fallback when no `empresa_email`/`empresa_telefone`), plus `name` (razao_social → empresa_nome → person name), `cnpj`, `segment`, `website`, `city`, `state`.

**Post-Deal Verify (Step 5h in lia-assign):** after `createNewDeal` / `updateExistingDeal`, run `updatePersonFields` + `findOrCreateCompany` again, then `GET /persons/{id}` and log `piperun_person_resync_ok` (or `piperun_contact_still_missing_after_resync` if `emails[]` and `phones[]` are still empty).

**Why:** Piperun's native Meta Lead Ads integration creates Persons with `emails[]`/`phones[]` empty. CSP cards were appearing without contact even when CDP had everything. Discovered 2026-05-12 — Luis Marcondes França (Deal 59724041) and ~390 other leads from 2026-05-09→12.

**Backfill:** `piperun-person-contact-backfill` edge function re-publishes full Person + Company payload for any canonical lead with `pessoa_piperun_id NOT NULL`. Accepts `{lead_ids|emails|days, limit}`. Logged via `system_health_logs.error_type='piperun_person_contact_backfilled'`.
