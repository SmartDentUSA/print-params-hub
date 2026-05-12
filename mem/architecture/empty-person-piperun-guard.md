---
name: Empty PipeRun Person Guard
description: Cached pessoa_piperun_id validated via GET; ghost Persons are swapped via findPersonExpanded; pessoa_piperun_id is persisted even when Deal creation is blocked; piperun-person-empty-sweeper remediates
type: feature
---
**Five-layer guard (2026-05-12, refined) to prevent CRM cards without contact and stop ghost-Person proliferation:**

1. **Cached Person validation** (`_shared/piperun-person-resolver.ts → validateCachedPerson`):
   `smart-ops-lia-assign` MUST validate `lead.pessoa_piperun_id` via `GET /persons/{id}` instead of an email/phone search. PipeRun's native Meta integration creates Persons with empty `emails[]`/`phones[]`; a contact-based search returns null and would cause the previous code to create a brand-new duplicate Person every run (saw 3+ shadow Persons per lead on 2026-05-12: julianachiode, carolina@suprir, sueniafaria). Only re-resolve when GET returns 404/410.

2. **Ghost-Person swap via `findPersonExpanded`**:
   Before trusting a cached Person whose `hasContact=false`, AND when no cached id exists, `lia-assign` calls `findPersonExpanded(apiToken, { email, phone, name })` from `_shared/piperun-person-resolver.ts`. The expanded resolver runs the strict contact filter, then falls back to `GET /persons?search=<name>` and `GET /persons?search=<email-localpart>` and only returns Persons that actually own contact data. This finds the Meta-created "ghost" Person owning the email/phone in raw fields invisible to `emails[email]`/`phones[phone]` filters. Logs swap as `error_type=piperun_person_swapped_empty_to_owner`.

3. **Empty-Person Deal guard** (`smart-ops-lia-assign`, before `createNewDeal`):
   After `updatePersonFields` + `verifyAndRecoverPersonContact`, call `getPersonContact(personId)`. If still zero emails AND zero phones, ABORT new Deal creation, log `deal_creation_blocked_empty_person`, and stamp `crm_creation_blocked='empty_person_in_piperun'` **plus persist `pessoa_piperun_id = personId`** so subsequent retries reuse the same id instead of creating yet another ghost Person each cycle (the Wendril Dias incident generated 3 ghost Persons in 30 min before this rule).

4. **Force-populate cached Person** (`forcePopulateCachedPerson` in `_shared/piperun-person-resolver.ts`):
   Before `findPersonExpanded` is even tried (both in `lia-assign` cached-empty branch and in the sweeper), attempt a minimal PUT (`{emails,phones,cellphone}` only — no `name`/`custom_fields`) followed by a GET to confirm the contact landed. Resolves the common case where the cached Person ID is correct but PipeRun rejected the previous combined PUT due to one bad field. Logs `piperun_person_force_populated`.

5. **Replace on silent reject** (sweeper):
   When the cached Person silently rejects the PUT AND no owner is found via expanded search AND we have at least one valid contact (email with valid TLD OR phone ≥10 digits), POST a fresh Person, verify it has contact, and remap `pessoa_piperun_id` to the new ID (logs `piperun_person_replaced_silent_reject`). Old ghost Person is left abandoned (PipeRun has no delete-on-empty API).

**TLD guard (Vilmar Mânica incident, 2026-05-12):** `isValidEmailTld` rejects emails whose final segment doesn't match `/^[a-z]{2,24}$/i` or matches a known typo set (`typo`, `local`, `lan`, `internal`, `test`, `invalid`, `example`). `updatePersonFields` strips email entirely from the PUT when invalid (only phone is sent), and `forcePopulateCachedPerson` returns `invalid_email_tld` so the sweeper logs `piperun_person_invalid_email_tld` and stamps `raw_payload.email_invalid_tld=true` instead of marking the lead unresolvable. A human-corrected email lets the next sweep retry.

**Sweeper:** `supabase/functions/piperun-person-empty-sweeper` runs the cascade Force-populate → ExpandedSearch → ReplaceOnSilentReject. Accepts `{ lead_ids: [...] }` for manual targeted reprocessing — bypasses both the `crm_creation_blocked_reason` filter AND the `empty_person_unresolvable` flag, so previously-marked-unresolvable leads can be retried after a human fix (e.g., correcting an email typo). Cron mode (no `lead_ids`) keeps the original filter and skips leads already marked unresolvable.

**Why:** Without these guards the system kept creating Deals attached to Persons that had no email/phone, leaving the kanban full of cards with "E-mail não informado / Telefone não informado".
