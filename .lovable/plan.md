# Fix: perda silenciosa de leads Meta Ads (janela `since_minutes` menor que o ciclo round-robin)

## Diagnóstico confirmado

- Cron `meta-lead-ads-pull` roda `* * * * *` chamando a função com `body: {"since_minutes": 15}` (confirmado em `cron.job`).
- Round-robin serializa 19 forms → cada form_id só é reconsultado a cada ~19 min.
- Janela de busca (15 min) < intervalo entre visitas ao mesmo form (~19 min) → gap cego recorrente de ~4 min por ciclo, mais gaps maiores quando há backoff/rate-limit. Bate com os 20 leads faltantes auditados.

## Mudanças

Escopo restrito: só `meta-lead-ads-pull` + cron. Não toco em ingest, cursor, backoff, `FORM_ID_TO_NAME`, nem no fluxo de forward.

### 1. `supabase/functions/meta-lead-ads-pull/index.ts`

- Elevar default de `sinceMinutes` de `30` para `45` (margem confortável sobre 19 min real + folga para backoffs de 30 min observados hoje). Continua sobrescrevível via body.
- Adicionar gap-detection log: após `claim_next_meta_pull_form`, ler o `created_at` do último `system_health_logs` com `function_name='meta-lead-ads-pull'`, `error_type='meta_pull_ok'` e `details->>'form_id' = <form_id atual>`. Se `now() - last_ok > sinceMinutes minutos`, emitir `system_health_logs` com `severity='warning'`, `error_type='meta_pull_window_gap_detected'`, `details = { form_id, last_ok_at, gap_minutes, since_minutes }`. Se não houver histórico, não loga (evita ruído na primeira execução após deploy).
- Nenhuma outra alteração de lógica.

### 2. Cron job (via `supabase--insert` — dados sensíveis com anon key, não migração)

- `cron.unschedule('meta-lead-ads-pull')` + `cron.schedule` novamente com o mesmo horário `* * * * *`, mesma URL/headers, mas `body := '{"since_minutes":45}'::jsonb`. Alinha o valor invocado com o novo default e deixa explícito.

## Fora deste deploy

- Backfill dos 20 leads perdidos de hoje (o usuário tem a lista). Faço em uma segunda rodada, provavelmente reinvocando `smart-ops-ingest-lead` diretamente para cada lead com `source: "meta_lead_ads"` e os campos que ele fornecer. Aguardo confirmação depois que este fix subir.

## Validação pós-deploy

- `SELECT * FROM system_health_logs WHERE function_name='meta-lead-ads-pull' ORDER BY created_at DESC LIMIT 30;` — esperar `meta_pull_ok` com `since_minutes: 45` alternando entre os 19 forms, nenhum `meta_pull_window_gap_detected` em regime normal.
- Se `meta_pull_window_gap_detected` aparecer com frequência, é sinal de que 45 min ainda ficou justo e precisamos subir mais (ou reduzir o número de forms/cadência).
