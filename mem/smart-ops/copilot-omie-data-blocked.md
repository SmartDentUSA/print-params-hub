---
name: Copilot Omie Data Blocked
description: Copilot está PROIBIDO de usar dados do Omie (ERP/NF). Toda análise comercial usa apenas dados do CRM (PipeRun).
type: constraint
---
**REGRA**: O Copilot (`smart-ops-copilot`) NÃO pode ler ou retornar dados do Omie em nenhum contexto.

Aplicações concretas:
- Tools `query_product_mix` e `query_product_sales` foram **REMOVIDAS** do schema e do dispatcher.
- `get_lead_card` NÃO inclui mais o bloco `omie: {...}` (codigo_cliente, faturamento_total, inadimplente, etc).
- `generate_commercial_report` NÃO chama mais `fn_mix_produtos_mes` — usa apenas `fn_itens_propostas_ganhas_mes` (PipeRun).
- `fn_product_owners(_busca)` foi recriada PipeRun-only (deals + deal_items). A coluna `fonte` retorna sempre `'piperun'`.
- SYSTEM_PROMPT contém regra explícita: se o usuário pedir "Omie", "NF" ou "faturamento Omie" → responder "Os dados do Omie estão bloqueados para o Copilot. Trabalho apenas com dados do CRM (PipeRun)."

**Por quê**: decisão do usuário em 22/05/2026 para evitar mistura de fontes e inflar/distorcer relatórios comerciais.

**NÃO afeta**: pipelines de sync Omie, cards do operador no frontend, outros agentes/serviços. A proibição é estritamente do Copilot.
