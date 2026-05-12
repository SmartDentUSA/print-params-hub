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

**Person Form Custom Fields (verified 2026-05-12):** `updatePersonFields` and the backfill MUST send `custom_fields:[{id,value}]` with the 4 form-response IDs (Pessoas):
- `772727` Mapeamento Scanner formulário (Texto): `scanner_modelo` → `tem_scanner — modelo` → `form_data` scan
- `772728` Mapeamento Impressora formulário (Texto): same cascade for impressora
- `673900` ÁREA DE ATUAÇÃO (Única escolha): `matchPiperunEnum(area_atuacao, PIPERUN_AREA_ATUACAO_ENUM)` — accent/case-insensitive + synonyms
- `445631` Especialidade principal (Múltipla escolha): `[matchPiperunEnum(especialidade, PIPERUN_ESPECIALIDADE_ENUM)]` (array)

Helper `buildPersonFormCustomFields(lead)` lives in `_shared/piperun-field-map.ts`. Old IDs `674001`/`674002` (PESSOA_CUSTOM_FIELDS) belong to **Empresas**, not Pessoas — keep disabled. If full PUT 4xx, retry without `custom_fields` so contact data still lands.

**PipeRun Silent Reject of emails/phones (verified 2026-05-12):** When the email/phone in the PUT payload already belongs to ANOTHER PipeRun Person, `PUT /persons/{id}` returns HTTP 200 but the array is silently dropped. `GET /persons/{id}` afterwards shows `emails:[]` / `phones:[]`. 127/266 leads in 24h hit this on 2026-05-12.

**Mitigations (live in `_shared/piperun-person-resolver.ts`):**
1. `findPersonByContact(apiToken, email, phone)` — cascade: `?emails[email]=` → `?search=email` → `?phones[phone]=` → `?search=<digits>`. Used by both `lia-assign:findPersonByEmail` and `_shared/piperun-hierarchy:findPersonByEmail`. Prevents creating a duplicate Person when one already owns either identifier.
2. `verifyAndRecoverPersonContact(...)` runs after every PUT in `lia-assign:updatePersonFields`, `_shared/piperun-hierarchy:updatePersonFields`, and `piperun-person-contact-backfill`. Workflow: GET `/persons/{id}` → if `emails`/`phones` missing, locate the rightful Person owning them and remap `lia_attendances.pessoa_piperun_id` (log `piperun_person_remapped_owner_of_email`). If no other Person owns it, retry isolated PUTs and log `piperun_email_silently_rejected` on persistent failure.
3. Backfill `mode:'remediate_silent_rejects'` re-runs verify-and-recover on every lead logged with `piperun_contact_still_missing_after_resync` or `piperun_email_silently_rejected` in the last 72h. Limit 200, throttle 250ms.
