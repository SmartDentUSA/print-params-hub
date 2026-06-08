---
name: Vendas Pipeline Immutability
description: Pipeline 18784 (Funil de Vendas) é intocável por automações — sem auto-estagnação, sem reatribuição automática de owner
type: constraint
---

Pipeline 18784 (Funil de Vendas) é INTOCÁVEL por automações.

- **Cron `stagnant-processor-cron` DESATIVADO** (`cron.unschedule` em 08/06/2026). Reativar exige aprovação explícita.
- **`smart-ops-stagnant-processor`**: guard no início do loop — se `piperun_pipeline_id === 18784` e deal não fechado, skip imediato com log `VENDAS_IMMUTABILITY`.
- **`smart-ops-lia-assign`**: guard antes do bloco round-robin — se lead já tem deal aberto em 18784, retorna `flow=vendas_immutability_skip` sem trocar owner, sem abrir/mover deal. Log em `system_health_logs` (`error_type='vendas_immutability_skip'`).
- **Régua nativa do PipeRun (Funil Estagnados)**: pausada manualmente na UI. Manter pausada.

**Why**: Crons + round-robin estavam movendo deals abertos de Vendas para Estagnados e trocando owners (~884 deals migrados, ~168 owners trocados desde 06/06/2026).

**How to apply**: Qualquer automação nova que toque `lia_attendances` ou faça PUT em deals do PipeRun DEVE checar `piperun_pipeline_id === 18784` e pular. Toda redistribuição em Vendas é manual via Copilot/UI.
