---
name: Timeline data quality guards (encoding, área, identidade)
description: Reparo de encoding em equip_*, normalização de area_atuacao vinda do PipeRun e backfill de person_id em lead_activity_log
type: feature
---
- **Encoding**: `_shared/equipment-field-guard.ts` expõe `repairEncoding()` (desfaz mojibake UTF-8→Latin1 e repara U+FFFD por dicionário) e rejeita labels que continuem com U+FFFD. Todo write de `equip_*` usa `sanitizeEquipmentLabel`, nunca o valor cru.
- **area_atuacao**: `smart-ops-piperun-webhook` NUNCA grava `person.job_title` cru em `area_atuacao` — só o resultado de `normalizeAreaAtuacao` (com `AREA_ATUACAO_SYNONYMS` em `_shared/zernio-field-normalizer.ts`); o cargo fica só em `pessoa_cargo`. Especialidades nunca vão para `area_atuacao`.
- **Identidade na timeline**: `resolve_lead_identity` pode retornar NULL quando o evento nasce antes da linha em `people` (corrida de segundos no sync PipeRun). Trigger `trg_backfill_activity_person` em `public.people` (AFTER INSERT) preenche `person_id/company_id` dos eventos dos últimos 7 dias; `smart-ops-activity-identity-backfill` continua como rede de segurança.
