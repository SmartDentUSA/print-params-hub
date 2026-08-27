---
name: Live Demo PipeRun Activity
description: Inscrição em demonstração ao vivo cria atividade "Live agendada" (Planejada, 60min, lembrete 5min) no deal atual do lead
type: feature
---

Toda inscrição pública em demonstração/live (`smartops-public-enrollment`) dispara
`smartops-live-demo-activity` (fire-and-forget, `verify_jwt = false`).

A função:
- resolve data/hora agendada em `smartops_turma_days` (1º dia) → fallback `start_date`/`launch_date` → data no `label`;
- espera até 12s (poll 2s) o deal aparecer em `deals` para o `lead_id` — ingest → lia-assign é assíncrono;
  escolhe Vendas aberto > qualquer aberto > mais recente; fallback `lia_attendances.piperun_id`;
- responsável = `owner_id` do deal (consulta `deals/{id}` no PipeRun se o espelho não tiver);
- cria atividade tipo **Live agendada** (`activity_type_id` resolvido por nome, fallback `271012`),
  `status: 0` (Planejada — status `1` é rejeitado pela API), duração 60, lembrete 5 min;
- grava evento `crm_live_activity` na timeline com `dedupe_key = live_activity:{enrollment_id}` (idempotente).

Nunca move, fecha ou altera deals — a Regra de Ouro continua inteiramente com `lia-assign`.
