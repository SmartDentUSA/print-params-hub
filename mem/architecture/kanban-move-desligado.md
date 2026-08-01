---
name: kanban-move Desligado
description: smart-ops-kanban-move sem chamadores; movimentação de etapa no PipeRun é manual, exceto lia-assign (criação/reativação) e stagnant-processor
type: constraint
---
`smart-ops-kanban-move` existe mas NÃO tem chamadores (01/08/2026). Removidos: invoke em `SmartOpsKanban.tsx`, passo 4 de `useEnrollment.ts` (contrato inválido, falhava em silêncio) e a tool `move_crm_stage` do `smart-ops-copilot`.

**Why**: PUT direto de `stage_id`+`pipeline_id` sem guard da Golden Rule; zero execuções reais na semana auditada.

**How to apply**: Movimentação de etapa em Vendas é manual na UI do PipeRun. Único move automático permitido: `smart-ops-lia-assign` (criação do deal ou reativação Estagnados→Vendas) e `smart-ops-stagnant-processor` (só dentro de Estagnados, cron desativado). Reativar kanban-move exige guard de Golden Rule próprio.
