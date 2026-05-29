## Diagnóstico

O código em `supabase/functions/wa-campaign-builder/index.ts` (linha 32) **já inclui** `'finished'` na lista de status permitidos para reativação. O erro `Campanha está finished — não pode ser (re)ativada` que o usuário acabou de receber vem da versão **antiga ainda em produção** — o deploy anterior não propagou (ou foi sobrescrito).

## Ação

1. **Redeploy** da função `wa-campaign-builder` via `deploy_edge_functions`.
2. **Validar** chamando `curl_edge_functions` com `{campaign_id}` da campanha finished que está sendo editada, esperando HTTP 200 e `ok: true`.
3. Se ainda falhar, puxar `edge_function_logs` da função para ver o status real que está chegando do banco.

## Sem mudança de código

Nada a editar — `_shared/evolution.ts`, `wa-dispatcher` e o builder já estão com o código correto no repo. É só operacional (deploy + smoke test).
