

## Contexto

A imagem mostra 3 opções da API de Marketing do Meta:
1. **Criar e gerenciar anúncios** — gerenciar campanhas/ads via API
2. **Mensurar dados de desempenho** — relatórios de performance dos anúncios
3. **Capturar e gerenciar leads** — ja implementado (`smart-ops-meta-lead-webhook`)

O usuario quer os 2 endpoints restantes prontos.

## Plano: 2 novas Edge Functions

### 1. `smart-ops-meta-ads-manager` — Gerenciar Anúncios

Endpoint proxy para criar/listar/atualizar campanhas e anúncios via Graph API do Meta.

- **GET** `/smart-ops-meta-ads-manager?action=list_campaigns&ad_account_id=act_XXX` — lista campanhas
- **GET** `?action=list_ads&campaign_id=XXX` — lista anúncios de uma campanha
- **POST** com body `{ action: "create_campaign", ad_account_id, name, objective, status }` — cria campanha
- **POST** `{ action: "update_ad_status", ad_id, status }` — pausa/ativa anúncio
- Usa `META_LEAD_ADS_TOKEN` (mesmo token, precisa de permissão `ads_management`)
- Todas as chamadas proxy para `graph.facebook.com/v21.0/`
- Loga operações na tabela existente ou retorna direto

### 2. `smart-ops-meta-ads-insights` — Dados de Desempenho

Endpoint para buscar métricas de performance dos anúncios.

- **GET** `?ad_account_id=act_XXX&date_preset=last_30d` — resumo da conta
- **GET** `?campaign_id=XXX&date_preset=last_7d` — métricas por campanha
- **GET** `?ad_id=XXX&time_range={"since":"2026-03-01","until":"2026-03-13"}` — métricas por anúncio
- Campos retornados: `impressions, clicks, spend, cpc, cpm, ctr, reach, conversions, cost_per_lead`
- Usa `META_LEAD_ADS_TOKEN` (precisa permissão `ads_read` ou `read_insights`)
- Breakdowns opcionais: `age`, `gender`, `publisher_platform`

### Alterações em config.toml

Adicionar:
```toml
[functions.smart-ops-meta-ads-manager]
verify_jwt = false

[functions.smart-ops-meta-ads-insights]
verify_jwt = false
```

### Secrets necessários

- `META_LEAD_ADS_TOKEN` — ja existe (precisa garantir que o token tenha as permissões `ads_management` e `read_insights` além de `leads_retrieval`)
- Nenhum novo secret necessário

### Estrutura dos arquivos

```
supabase/functions/smart-ops-meta-ads-manager/index.ts
supabase/functions/smart-ops-meta-ads-insights/index.ts
```

Ambos seguem o padrão CORS + verificação de token + proxy para Graph API, igual ao webhook de leads existente.

