## Pausar crons de briefing e copilot brain refresh

Executar um `UPDATE` em `cron.job` para desativar (`active=false`) todos os jobs ativos cujo `command` ou `jobname` contenha `briefing`, `refresh_copilot_brain` ou `copilot`. Reversível bastando setar `active=true` depois.

### SQL (via migration)

```sql
UPDATE cron.job
SET active = false
WHERE active = true
  AND (
       command ILIKE '%briefing%'
    OR command ILIKE '%refresh_copilot_brain%'
    OR jobname ILIKE '%briefing%'
    OR jobname ILIKE '%copilot%'
  );
```

### Observações
- Após aprovar, rodo via `supabase--migration` para você ver o diff/preview.
- Retorno com a lista de `jobid/jobname/schedule` que foram pausados (via `supabase--read_query` pós-execução).
- Nada de código de app é alterado — só o scheduler do Postgres. Os edge functions continuam existindo; só param de ser disparados pelo `pg_cron`.
- Para reativar depois: `UPDATE cron.job SET active = true WHERE jobname IN (...)`.
