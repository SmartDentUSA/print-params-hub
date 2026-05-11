---
name: Person origin and company-like name detection
description: PipeRun Person.origin_id is set on creation only (frozen at first contact); names matching razão social patterns trigger SDR review notes
type: feature
---
**Person origin policy**:
- `createPerson()` in `_shared/piperun-hierarchy.ts` accepts `originId` and writes it to PipeRun.
- `updatePersonFields()` accepts originId but lia-assign does NOT pass it on updates — Person.origin is frozen at first contact (consistent with mem://smart-ops/person-vs-deal-origin-separation).
- lia-assign resolves origin from `lead.origem_primeiro_contato` || `lead.form_name` and passes it to the create paths.

**Company-like name detection**:
- Helper `isCompanyLikeName()` in `_shared/identity-utils.ts` flags names that look like razão social: matches keywords (clinica, ltda, instituto, estética, etc.), is fully UPPERCASE with 2+ tokens, or equals `empresa_razao_social`/`empresa_nome`.
- When detected: lia-assign STILL creates Person/Company (does not block), but logs `system_health_logs.error_type='person_name_is_company'` and adds a Deal note via `addDealNote`: "⚠️ Nome do contato veio do formulário como razão social — confirmar nome real no primeiro atendimento."
- Triggered by Meta lead forms where `full_name` field came filled with a clinic name (e.g. ESTÉTICA AVANÇADA) instead of a person name.
