

# Plano: Testar as 3 Edge Functions Meta Ads

## Contexto
- Ad Account: `act_1946671865603544` (Smart Dent)
- Os 3 secrets já estão configurados: `META_LEAD_ADS_TOKEN`, `META_ADS_MANAGER_TOKEN`, `META_ADS_INSIGHTS_TOKEN`
- Token gerado no Graph API Explorer com permissões de ads

## Testes a executar

### 1. `smart-ops-meta-ads-manager` — list_campaigns
Chamada com `action: "list_campaigns"` e `ad_account_id: "act_1946671865603544"` para verificar se o token funciona e retorna campanhas.

### 2. `smart-ops-meta-ads-insights` — account_insights
Chamada com `action: "account_insights"` e `ad_account_id: "act_1946671865603544"` com `date_preset: "last_30d"` para verificar métricas.

### 3. `smart-ops-meta-lead-webhook` — verificação GET
Teste de verificação do webhook (GET com hub.mode=subscribe) para confirmar que o endpoint responde corretamente.

## Ações
Usar `supabase--curl_edge_functions` para chamar cada função e verificar os resultados. Nenhuma alteração de código necessária.

