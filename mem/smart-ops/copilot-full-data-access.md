---
name: Copilot Full Data Access
description: Copilot tem acesso total às tools de leitura + Cérebro como contexto; blocklist vazia, sem allowlist
type: feature
---
Copilot (`smart-ops-copilot/index.ts`):
- Cérebro (`copilot_brain`) continua injetado como `BRAIN CONTEXT` a cada turno (fonte canônica de KPIs agregados do mês).
- Todas as tools registradas estão expostas ao LLM (substituímos `ACTION_TOOLS_ALLOWLIST` por `TOOLS_BLOCKLIST` vazio).
- Tools de leitura habilitadas: query_leads, query_leads_advanced, query_table, describe_table, query_stats, query_deal_history, query_sales_summary, query_proposal_items_sold, query_ecommerce_orders, query_enrollments, query_opportunity_rules, query_product_owners, query_owner_purchase_history, query_scanner_brand_distribution, query_printer_brand_distribution, get_lead_card, verify_consolidation, check_missing_fields, get_product_anti_hallucination + 7 search_* (RAG).
- Regra de uso (system prompt #7): Cérebro PRIMEIRO para KPIs do mês; tools de leitura livres para drill-down/granular/histórico fora do mês. Nunca inventar — vazio = "sem dados".
