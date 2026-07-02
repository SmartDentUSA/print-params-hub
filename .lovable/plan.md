## Reimplantação sequencial das 4 EFs pós-restore

Executo tudo em uma sequência única, com verificação de saúde do pool entre cada deploy. Se qualquer `SELECT 1` demorar mais que ~500ms ou falhar, paro imediatamente e reporto.

### Pré-check
- `SELECT 1` — confirmar pool saudável antes de começar.
- `SELECT count(*) FROM cron.job WHERE command ILIKE '%refresh_copilot_brain%' OR command ILIKE '%briefing%'` — confirmar 0 (crons desagendados).
- `pg_get_functiondef('public.try_acquire_briefing_lock(uuid)'::regprocedure)` — confirmar que contém `ON CONFLICT (lead_id) DO NOTHING`.

Se qualquer pré-check falhar, aborto e reporto — não reimplanto EF nenhuma sobre banco doente ou lock não corrigido.

### Sequência de deploy

1. **Deploy `smart-ops-lia-assign`** (via `supabase--deploy_edge_functions`)
   - `SELECT 1` — latência esperada < 500ms.
   - Checar `system_health_logs` últimos 2min por `briefing_lock_error` / `cog_lock_skipped` acima do normal.

2. **Deploy `enrichment-safety-net-cron`**
   - `SELECT 1`.
   - `SELECT count(*) FROM enrichment_safety_queue WHERE processed_at IS NULL` — baseline antes de drenar.

3. **Deploy `smart-ops-piperun-webhook`**
   - `SELECT 1`.

4. **Deploy `smart-ops-copilot`**
   - `SELECT 1`.

### Pós-deploy — confirmar drenagem

- `SELECT count(*) FILTER (WHERE processed_at IS NULL) AS pending, count(*) FILTER (WHERE processed_at IS NOT NULL AND processed_at > now() - interval '5 min') AS drained_recent FROM enrichment_safety_queue` — repito 2x com 60s de intervalo.
- Esperado: `pending` caindo, `drained_recent` > 0.
- Se `pending` não cair em 3min, inspeciono `last_error` / `attempt_count` dos itens presos e reporto.

### Relatório final
- 4 EFs reimplantadas: OK/FAIL por função
- Latência do pool após cada deploy (ms)
- `enrichment_safety_queue`: pending inicial → pending após 2min
- Erros relevantes em `system_health_logs` (se houver)

### O que NÃO vou fazer
- Não reagendo `refresh_copilot_brain` nem `briefing` cron.
- Não reativo Realtime (kill-switch fica ativo pelas próximas 24h).
- Não faço deploys em paralelo — estritamente sequencial com gate de `SELECT 1`.
