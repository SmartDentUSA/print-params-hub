---
name: Empty PipeRun Person Guard
description: Cached pessoa_piperun_id is validated via GET /persons/{id}; new Deal creation aborts when Person has no email/phone in PipeRun
type: feature
---
**Two-layer guard added 2026-05-12 to prevent CRM cards without contact:**

1. **Cached Person validation** (`_shared/piperun-person-resolver.ts → validateCachedPerson`):
   `smart-ops-lia-assign` MUST validate `lead.pessoa_piperun_id` via `GET /persons/{id}` instead of an email/phone search. PipeRun's native Meta integration creates Persons with empty `emails[]`/`phones[]`; a contact-based search returns null and would cause the previous code to create a brand-new duplicate Person every run (saw 3+ shadow Persons per lead on 2026-05-12: julianachiode, carolina@suprir, sueniafaria). Only re-resolve when GET returns 404/410.

2. **Empty-Person Deal guard** (`smart-ops-lia-assign`, before `createNewDeal`):
   After `updatePersonFields` + `verifyAndRecoverPersonContact` have run, call `getPersonContact(personId)`. If the Person card still has zero emails AND zero phones, ABORT new Deal creation, log `error_type='deal_creation_blocked_empty_person'`, and stamp `lia_attendances.crm_creation_blocked='empty_person_in_piperun'`. The retry-cron + `piperun-person-contact-backfill` will fix the Person before the next attempt.

**Why:** Without these guards the system kept creating Deals attached to Persons that had no email/phone, leaving the kanban full of cards with "E-mail não informado / Telefone não informado".
