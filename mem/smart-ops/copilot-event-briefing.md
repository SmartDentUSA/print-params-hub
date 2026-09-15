---
name: Copilot Event Briefing
description: Tool query_event_briefing dá ao Copilot acesso total a evento/congresso — palestrantes, temas, sessões, combos da tabela promocional, cupons e consultores no estande
type: feature
---
`smart-ops-copilot` → `query_event_briefing({ event, include_items? })`:
- Resolve `smartops_events` por UUID > slug > ilike(name), ordenado por start_date desc.
- Evento: datas, start_time/end_time, local, company_stand, website, instagram, audience_areas/specialties/notes, about_event_pt, partner_brands, drive_folder_url.
- Palestrantes vêm do JSONB `speakers`: nome, especialidade, mini CV, instagram, foto, temas (topics/themes), `sessions` (demonstrações) e `support_sessions` (apoio comercial).
- Tabela promocional: `promotional_tables` por `event_id` (prioriza `status='active'`), com `promotional_table_sections` (combos) + `promotional_table_items`; calcula valor_mercado, valor_promocional, economia e economia_pct **por combo** (nunca soma de combos) e traz `main_product_name` como produto de interesse.
- Cupons: `promotional_coupons` da tabela (code, seller_name, kind, free_shipping, desconto, validade, limite, status de sync na Loja Integrada).
- Formulário do evento: `smartops_forms` por `event_id` → `event_consultant_ids` resolvidos em `team_members` (nome, email, whatsapp_number, ativo).

Prompt "EVENTOS E CONGRESSOS" instrui o encadeamento para campanha de evento:
query_event_briefing → query_proposal_items_sold → query_printer/scanner_brand_distribution → search_products + get_product_anti_hallucination → query_product_owners.

`query_table` liberado também para smartops_events, promotional_table_sections, promotional_table_items, smartops_forms.

Validado: 19º CIPRO (17–19/09/2026, estande E460) — 7 palestrantes, 1 tabela, 13 combos, 16 cupons.
