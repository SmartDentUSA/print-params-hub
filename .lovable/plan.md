# Zernio webhook: responder em <5s e processar em background

## Problema
O endpoint `smart-ops-zernio-lead-webhook` só responde depois de terminar todo o pipeline: valida assinatura, grava o dedup, chama `smart-ops-ingest-lead` (que por sua vez faz CRM/PipeRun) e só então devolve 200. Esse encadeamento passa dos 5s de limite da Zernio, então 32 de 34 entregas abortam na 1ª tentativa e voltam como retry. No retry o dedup por `leadgen_id` já existe, então responde `deduped: true` — o lead entra uma vez só, mas todo delivery gasta duas tentativas e fica sem confirmação de sucesso real.

## Correção
Separar "aceitar" de "processar":

1. No caminho síncrono ficam apenas operações rápidas: verificação da assinatura HMAC, parse do JSON, checagem de `lead.leadgenId` e o INSERT atômico em `zernio_leadgen_dedup`.
2. Se o INSERT retorna conflito (23505), responde `200 { deduped: true }` na hora, como hoje.
3. Se o INSERT passa, agenda o restante (normalização dos campos, mapeamento de produto, chamada ao `smart-ops-ingest-lead`, update do `lead_id` no dedup) com `EdgeRuntime.waitUntil(...)` e responde `200 { accepted: true, leadgen_id }` imediatamente.
4. Em caso de falha no processamento em background: registrar o erro em `zernio_leadgen_dedup` (campo de erro/status) e em `system_health_logs`, para que a falha não fique invisível agora que o 200 é dado antes.

## Recuperação de falhas
Como a Zernio não vai mais reentregar (recebe 200 na primeira), a linha de dedup vira o registro de estado: quando o ingest falha, ela fica marcada com o erro e sem `lead_id`. Um passo de reprocesso manual/cron pode varrer linhas com `lead_id IS NULL` e erro registrado e reenviar ao ingest.

## Detalhes técnicos
- Arquivo: `supabase/functions/smart-ops-zernio-lead-webhook/index.ts`.
- Usar `EdgeRuntime.waitUntil(promise)` (suportado no runtime Deno do Supabase) para manter a invocação viva após o `Response`.
- Manter a resposta 401 para assinatura inválida e 400 para JSON inválido / `leadgenId` ausente — todos síncronos e rápidos.
- Nenhuma mudança no `smart-ops-ingest-lead` nem no `social-flow-webhook`.
- Migration pequena em `zernio_leadgen_dedup`: colunas `process_status` (`pending`/`done`/`failed`, default `pending`) e `process_error` text, com GRANTs preservados.

## Validação
- Reenviar um payload de teste e confirmar tempo de resposta bem abaixo de 5s.
- Conferir nos logs da função que o ingest continua concluindo depois do 200.
- Conferir com a Zernio (ou nos logs) que as próximas entregas passam na 1ª tentativa, sem `deduped: true`.
