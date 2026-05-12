---
name: Empty PipeRun Person Guard
description: Cached pessoa_piperun_id validated via GET; ghost Persons are swapped via findPersonExpanded; pessoa_piperun_id is persisted even when Deal creation is blocked; piperun-person-empty-sweeper remediates
type: feature
---
**Three-layer guard (2026-05-12, expanded later same day) to prevent CRM cards without contact and stop ghost-Person proliferation:**

1. **Cached Person validation** (`_shared/piperun-person-resolver.ts → validateCachedPerson`):
   `smart-ops-lia-assign` MUST validate `lead.pessoa_piperun_id` via `GET /persons/{id}` instead of an email/phone search. PipeRun's native Meta integration creates Persons with empty `emails[]`/`phones[]`; a contact-based search returns null and would cause the previous code to create a brand-new duplicate Person every run (saw 3+ shadow Persons per lead on 2026-05-12: julianachiode, carolina@suprir, sueniafaria). Only re-resolve when GET returns 404/410.

2. **Ghost-Person swap via `findPersonExpanded`**:
   Before trusting a cached Person whose `hasContact=false`, AND when no cached id exists, `lia-assign` calls `findPersonExpanded(apiToken, { email, phone, name })` from `_shared/piperun-person-resolver.ts`. The expanded resolver runs the strict contact filter, then falls back to `GET /persons?search=<name>` and `GET /persons?search=<email-localpart>` and only returns Persons that actually own contact data. This finds the Meta-created "ghost" Person owning the email/phone in raw fields invisible to `emails[email]`/`phones[phone]` filters. Logs swap as `error_type=piperun_person_swapped_empty_to_owner`.

3. **Empty-Person Deal guard** (`smart-ops-lia-assign`, before `createNewDeal`):
   After `updatePersonFields` + `verifyAndRecoverPersonContact`, call `getPersonContact(personId)`. If still zero emails AND zero phones, ABORT new Deal creation, log `deal_creation_blocked_empty_person`, and stamp `crm_creation_blocked='empty_person_in_piperun'` **plus persist `pessoa_piperun_id = personId`** so subsequent retries reuse the same id instead of creating yet another ghost Person each cycle (the Wendril Dias incident generated 3 ghost Persons in 30 min before this rule).

**Sweeper:** `supabase/functions/piperun-person-empty-sweeper` resolves all blocked leads. For each it runs `findPersonExpanded`; if an owner with contact is found it remaps `pessoa_piperun_id`, clears the block and re-invokes `lia-assign`. Otherwise it stamps `raw_payload.empty_person_unresolvable=true` for manual review (no further retries).

**Why:** Without these guards the system kept creating Deals attached to Persons that had no email/phone, leaving the kanban full of cards with "E-mail não informado / Telefone não informado".
