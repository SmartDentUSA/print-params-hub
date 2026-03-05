

## Corrigir Deploy das Edge Functions SellFlux

### Problema
Os logs de `2026-03-04T23:56` mostram dois erros:
1. `smart-ops-sellflux-webhook` linha 195: `supabase.from(...).insert(...).catch is not a function`
2. `smart-ops-ingest-lead`: `supabase.rpc(...).catch is not a function`

O código no repositório já foi corrigido (usa `try/catch` e `.then()`), mas as funções deployadas ainda executam a versão antiga.

### Solução
Simplesmente **redeployar** as 3 funções afetadas:
- `smart-ops-sellflux-webhook`
- `smart-ops-ingest-lead`  
- `smart-ops-sellflux-sync`

Após o deploy, repetir o teste com o lead `oraculosmartdent@gmail.com` e verificar os logs.

