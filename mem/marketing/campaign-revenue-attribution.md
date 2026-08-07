---
name: Atribuição de receita e lead time por campanha
description: fn_campaign_revenue só conta deals ganhos com closed_at real e fechados após a conversão do lead na campanha; detalhe por deal expõe cross-sell
type: feature
---
- `fn_campaign_revenue(p_from,p_to)` retorna `revenue`, `won_deals`, `won_leads`, `leads_converted`, `avg_lead_time_days`.
- **Lead time = entrada no Funil de Vendas → entrada no funil de CS** (não é conversão→fechamento). Calculado por `fn_campaign_funnel_times()`: preferência para `piperun_stage_transitions` (pipeline ILIKE '%vendas%' / '%cs%|%onboarding%'); fallback no espelho `deals` (deal que migrou p/ CS nasceu em Vendas → `created_at` = entrada Vendas, `closed_at` = entrada CS).
- Âncora de conversão do lead = último evento `meta_ads_lead_entry`/`zernio_lead_raw` em `lead_activity_log`, fallback `entrada_sistema`/`created_at`.
- Regras: só leads canônicos (`merged_into IS NULL`), `status='ganha'`, `closed_at NOT NULL` (nunca fallback para `piperun_updated_at`), `closed_at >= conversão` e dentro do período. Isso elimina deals antigos creditados à campanha de último toque.
- Receita soma TODAS as propostas ganhas após a conversão, independente do produto anunciado (cross-sell é esperado).
- `fn_campaign_revenue_detail(p_campaign_id,p_from,p_to)` lista por deal: lead, funil, valor, conversão, fechamento, lead time, `campaign_product` (produto_interesse) vs `purchased_products` (deal_items) e flag `cross_sell`.
- UI: aba Anúncios (`ZernioAdsTab`) mostra colunas Receita (clicável → `CampaignRevenueDialog`), ROI, Vendas e Lead time.