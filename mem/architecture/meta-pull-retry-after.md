---
name: Meta pull — retry com Retry-After
description: meta-lead-ads-pull usa _shared/meta-retry.ts (Retry-After + estimated_time_to_regain_access) para retry inline curto e backoff parkeado longo
type: feature
---
`supabase/functions/_shared/meta-retry.ts` centraliza o retry das chamadas Graph:
- `parseRetryAfter` aceita delta-seconds e HTTP-date; `parseRegainAccessSeconds` lê `estimated_time_to_regain_access` (minutos) do header BUC; `retryDelaySeconds` usa o maior dos dois.
- 429/5xx/erro de rede → até 3 tentativas com backoff exponencial (500ms base, jitter). Se a espera pedida pela Meta ≤5s, dorme inline; se maior, retorna `retryAfterSeconds` sem dormir.
- 2xx e 4xx (exceto 429) nunca são repetidos.

Em `meta-lead-ads-pull`, o valor retornado define a duração do `cron_state.meta_pull_backoff_until` (1–120min, fallback 30min) em vez dos 30min fixos. Falha total de transporte emite `meta_pull_fetch_exhausted` (severity=error); retries emitem `meta_pull_retried`.

Testes: `supabase/functions/meta-lead-ads-pull/meta-retry_test.ts` (10 casos, `deno test`).

**Watermark de janela (retentativa automática).** O gap-detector lê o último `meta_pull_ok` daquele `form_id` para expandir o lookback. Por isso `meta_pull_ok` só é emitido quando a janela foi 100% drenada. Qualquer abort — `fetch_exhausted`, `rate_limited`, `http_4xx/5xx`, `max_pages_reached`, `timeout_reached` — emite `meta_pull_window_incomplete` (severity=warning, com `incomplete_reason` e `will_retry_next_cycle:true`) e NÃO move o watermark. Resultado: o próximo ciclo do round-robin re-expande o lookback até cobrir a janela falhada. Sem isso, um `meta_pull_ok` após falha marcaria como lida uma janela nunca lida = perda silenciosa.
