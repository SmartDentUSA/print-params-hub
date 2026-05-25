---
name: PipeRun Funnel Reconciler
description: Hourly detective layer compares PipeRun Funil de Vendas (18784) vs lia_attendances and triggers backfill for any deal missing from the CDP
type: feature
---

`smart-ops-piperun-funnel-reconciler` roda a cada hora (`20 * * * *`, cron `piperun-funnel-reconciler-hourly`) e fecha o gap entre o Funil de Vendas do PipeRun e o nosso CDP.

**Pipeline:**
1. `GET /deals?pipeline_id=18784&updated_since=last_2h` (paginado, até 20 páginas × 100).
2. `SELECT piperun_id FROM lia_attendances WHERE piperun_id IN (...)` — chunked por 200 IDs.
3. Qualquer `deal.id` ausente é considerado gap.
4. Se `gap_count > 0` → dispara **fire-and-forget** `smart-ops-sync-piperun?orchestrate=true&pipeline_id=18784&since_hours=N` (parâmetro novo `since_hours` adicionado a `smart-ops-sync-piperun` para sobrescrever o default de 35min).
5. Loga sempre em `system_health_logs` com `function_name='piperun_funnel_reconciler'`:
   - `severity='info'` quando gap=0
   - `severity='warning'` quando 1 ≤ gap ≤ 10
   - `severity='critical'` quando gap > 10
   - `details.gap_sample[]` traz os primeiros 20 deals ausentes (deal_id, title, email, created_at)

**Invocação manual:** `?hours=72` para backfills históricos amplos (max 168h = 7 dias).

**Por que existe:** o Funil de Vendas pode receber deals via integração nativa PipeRun↔Meta sem passar pelo nosso `meta-lead-ads-pull` (forms fora do escopo monitorado). Sem este reconciliador, esses leads ficavam órfãos por até 7 dias (até o watchdog semanal). Agora a perda máxima é 1h.