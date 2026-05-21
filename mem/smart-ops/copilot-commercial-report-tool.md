---
name: Copilot Commercial Report Tool
description: generate_commercial_report agrega totais, ranking, mix, pipeline e leads novos em uma chamada; template obrigatório no SYSTEM_PROMPT
type: feature
---
**Tool**: `generate_commercial_report({ ano, mes })` em `smart-ops-copilot`.

**Trigger no prompt**: "relatório", "report", "performance comercial", "fechamento do mês", "panorama do mês", "como foi o mês X", "resumo do mês".

**Payload (Promise.all)**:
- `totals_mes` + `totals_mes_anterior` (fn_total_vendas_mes) com `delta_mom` calculado server-side (receita_pct, deals_pct, ticket_pct).
- `ranking_vendedores` (fn_resumo_vendas_mes — taxa_conversao capped em 100%).
- `mix_produtos` (fn_mix_produtos_mes — Omie ERP).
- `pipeline` + `pipeline_total_value` (invoke `pipeline-funnel-data`).
- `leads_novos_mes` (count em lia_attendances WHERE merged_into IS NULL + created_at no mês).
- `instrucao_render` força LLM a apenas formatar.

**Regras críticas**:
- PROIBIDO encadear `query_sales_summary` + `query_product_mix` para montar relatório.
- PROIBIDO calcular delta % manualmente — usar `delta_mom`.
- Template obrigatório com 5 seções (Resumo Executivo, Ranking, Mix, Pipeline, Insights).
- Campo null → "Não disponível", nunca chute.
