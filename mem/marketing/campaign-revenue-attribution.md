---
name: Atribuição de receita e lead time por campanha
description: fn_campaign_revenue só conta deals ganhos com closed_at real e fechados após a conversão do lead na campanha; detalhe por deal expõe cross-sell
type: feature
---
- `fn_campaign_revenue(p_from,p_to)` retorna `revenue`, `won_deals`, `won_leads`, `leads_converted`, `avg_lead_time_days`.
- **Lead time por campanha = entrada do lead na campanha → primeira entrada ganha no funil de CS/Onboarding após essa conversão.** O intervalo selecionado forma a coorte pela data de entrada na campanha; assim 30 dias, 12 meses e Histórico recalculam médias próprias para comparar a eficiência dos criativos. Nunca usar o primeiro deal histórico da pessoa.
- Âncora de conversão do lead = último evento `meta_ads_lead_entry`/`zernio_lead_raw` em `lead_activity_log`, fallback `entrada_sistema`/`created_at`.
- Regras de receita: só leads canônicos (`merged_into IS NULL`), `status='ganha'`, `closed_at NOT NULL` (nunca fallback para `piperun_updated_at`) e `closed_at >= conversão`. Lead time usa a coorte de conversões do período e o CS do mesmo deal posterior à conversão.
- Receita soma TODAS as propostas ganhas após a conversão, independente do produto anunciado (cross-sell é esperado).
- `fn_campaign_revenue_detail(p_campaign_id,p_from,p_to)` lista por deal: lead, funil, valor, conversão, fechamento, lead time, `campaign_product` (produto_interesse) vs `purchased_products` (deal_items) e flag `cross_sell`.
- UI: aba Anúncios (`ZernioAdsTab`) mostra colunas Receita (clicável → `CampaignRevenueDialog`), ROI, Vendas e Lead time.
## Âncora de conversão (auditoria 07/08/2026)
- Quando o evento `meta_ads_lead_entry`/`zernio_lead_raw` não traz `campaignId` no payload, o fallback usa `platform_campaign_id` do lead **com o `event_timestamp` real do evento** — NUNCA `entrada_sistema`/`created_at`.
- Motivo: `entrada_sistema` é o 1º contato histórico do lead. Com ele, vendas de 2023 e de meses anteriores eram atribuídas a campanhas de julho/2026 (ex.: Larissa 2023, Claudio 2023, Fábio e Eduardo em março), inflando receita de R$ 40.294 e gerando lead time de 1.224 d / 308 d.
- Receita limpa (histórico completo): 61.070 / 28.000 / 28.000 / 1.140 — 1 deal ganho por campanha.
