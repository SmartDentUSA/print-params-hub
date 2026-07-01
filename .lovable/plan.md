## Diagnóstico: crons de "briefing" e "refresh_copilot_brain"

### 1. `refresh_copilot_brain` — NÃO passa por Edge Function
O cron `copilot-brain-refresh-5min` (a cada 5min) e `copilot-brain-drift-hourly` chamam **diretamente a função SQL** `public.refresh_copilot_brain(p_force boolean)` via `pg_cron` + `pg_net` (ou `SELECT` direto). Ela é apenas um wrapper com advisory lock 737373 + debounce 60s em cima de `copilot_brain.refresh_all()`.

**Chamadores inline (não são o cron, mas disparam a mesma RPC):**
- `supabase/functions/smart-ops-copilot/index.ts:3130` — força refresh se snapshot >10min
- `supabase/functions/smart-ops-piperun-webhook/index.ts:1663` — fire-and-forget pós-webhook

Desativar Edge Functions **não vai parar** este cron — ele é 100% SQL. A única forma é `UPDATE cron.job SET active=false` ou `cron.unschedule(jobid)`.

### 2. "briefing" — não existe Edge Function com esse nome
Nenhuma EF nomeada `*briefing*` no repositório. O que existe:
- `smart-ops-lia-assign` → chama a RPC `try_acquire_briefing_lock` (insere em `briefing_locks`) e gera o briefing DeepSeek inline (`actionLabel: "generate-briefing-deepseek"`).
- `_shared/waleads-messaging.ts` (usada por várias EFs) → gera briefing Gemini Lite (`generate-briefing-gemini-lite`) e lê `smartops_seller_briefings` (tipos `briefing_vendedor`, `briefing_vendedor_block`).
- `smart-ops-preview-seller-note` — preview de nota (inclui briefing).

**Se existe um cron cujo `command` contém "briefing"**, ele muito provavelmente:
- (a) faz `net.http_post` para `smart-ops-lia-assign` (ou `smart-ops-preview-seller-note`) em loop; OU
- (b) chama uma função SQL tipo `try_acquire_briefing_lock` / limpeza de `briefing_locks` direto.

### 3. Se chamam SQL direto ou EF
- `refresh_copilot_brain` → **SQL direto** (RPC no Postgres). Desativar EF não resolve.
- `briefing` → provavelmente **EF via `net.http_post`** (`smart-ops-lia-assign`), mas não temos como confirmar sem ler `cron.job.command` — o pool está esgotado exatamente por isso.

### Recomendação de ação imediata (via painel Supabase)

Como o pool está esgotado e as ferramentas de SQL estão dando timeout, o caminho mais seguro é **pausar as Edge Functions candidatas no Dashboard** (Settings → Edge Functions → Pause) para cortar o loop enquanto o pool respira:

1. **Pause** `smart-ops-lia-assign` — corta o loop de briefing/enfileiramento.
2. **Pause** `smart-ops-piperun-webhook` — corta o `refresh_copilot_brain(false)` fire-and-forget pós-webhook.
3. **Pause** `smart-ops-copilot` — corta o `refresh_copilot_brain(true)` inline.
4. **Pause** `enrichment-safety-net-cron` — se estiver invocando `smart-ops-lia-assign` (é o principal loop de safety net).

Isso **não pára** os `pg_cron` jobs de `refresh_copilot_brain` (SQL puro). Para esses, quando o pool voltar, rode no SQL Editor:

```sql
UPDATE cron.job
SET active = false
WHERE jobname IN ('copilot-brain-refresh-5min','copilot-brain-drift-hourly');
-- ou
SELECT cron.unschedule(jobid) FROM cron.job
 WHERE command ILIKE '%refresh_copilot_brain%' OR command ILIKE '%briefing%';
```

### Próximo passo desta plan
Se me der ok, quando o pool liberar eu:
1. Rodo `SELECT jobid, jobname, schedule, command FROM cron.job WHERE command ILIKE '%briefing%' OR command ILIKE '%refresh_copilot_brain%' OR jobname ILIKE '%copilot%'` para confirmar quais EFs (se alguma) são chamadas por `net.http_post`.
2. Executo o `UPDATE cron.job SET active=false ...` (ou `cron.unschedule`) e retorno a lista pausada.
