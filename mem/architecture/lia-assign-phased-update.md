---
name: lia-assign phased update (critical + enrichment)
description: smart-ops-lia-assign splits the post-PipeRun update into critical CRM binding and best-effort enrichment to prevent orphan deals
type: feature
---
- Após criar/atualizar Person/Company/Deal no PipeRun, `smart-ops-lia-assign` faz UPDATE em `lia_attendances` em duas fases:
  1. **CRITICAL** (obrigatório): `proprietario_lead_crm`, `funil_entrada_crm`, `ultima_etapa_comercial`, `piperun_id`, `piperun_link`, `pessoa_piperun_id`, `empresa_piperun_id`, `status_oportunidade`. Falha aqui → 500 + `system_health_logs.lead_update_failed` (phase=critical).
  2. **ENRICHMENT** (best-effort): demais campos (empresa_*, área, especialidade, etc.). Falha aqui apenas loga `lead_enrichment_update_failed` (phase=enrichment) e não retorna erro.
- **Why**: o erro recorrente `column "value" does not exist` (42703) vinha da parte de enrichment (campos vindos do PipeRun company/deal) e bloqueava a gravação dos IDs críticos, gerando deals órfãos no PipeRun (sem `piperun_id` salvo no CDP) e duplicidade em retentativas.
- **How to apply**: nunca colocar campo de identidade do Deal (piperun_id, pessoa/empresa_piperun_id) no bucket de enrichment.
