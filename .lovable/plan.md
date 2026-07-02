Entendido. Fico em standby. Assim que você disser "restaurado", executo a sequência abaixo sem parar entre etapas.

## Sequência automática pós-restore

### Etapa 1 — Verificar pool respondendo
```sql
SELECT 1;
```
Se timeout, aviso e espero. Se OK, sigo.

### Etapa 2 — Desagendar crons perigosos (via supabase--read_query como SELECT que executa `cron.unschedule`)
```sql
SELECT jobid, jobname, cron.unschedule(jobid) AS unscheduled
FROM cron.job
WHERE command ILIKE '%refresh_copilot_brain%'
   OR command ILIKE '%briefing%';
```

### Etapa 3 — Confirmar zero jobs restantes
```sql
SELECT jobid, jobname, schedule, command
FROM cron.job
WHERE command ILIKE '%refresh_copilot_brain%'
   OR command ILIKE '%briefing%';
```
Esperado: 0 linhas. Se sobrar algum, repito unschedule direcionado.

### Etapa 4 — Migration do lock idempotente (supabase--migration)
```sql
CREATE UNIQUE INDEX IF NOT EXISTS briefing_locks_lead_id_key
  ON public.briefing_locks(lead_id);

CREATE OR REPLACE FUNCTION public.try_acquire_briefing_lock(p_lead_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted boolean := false;
BEGIN
  INSERT INTO public.briefing_locks(lead_id, acquired_at)
  VALUES (p_lead_id, now())
  ON CONFLICT (lead_id) DO NOTHING
  RETURNING true INTO v_inserted;

  RETURN COALESCE(v_inserted, false);
END;
$$;
```

### Etapa 5 — Verificar função aplicada
```sql
SELECT pg_get_functiondef('public.try_acquire_briefing_lock(uuid)'::regprocedure);
```
Confirmar que contém `ON CONFLICT (lead_id) DO NOTHING`.

### Etapa 6 — Redeploy das 4 EFs, uma por vez, na ordem
1. `smart-ops-lia-assign`
2. `enrichment-safety-net-cron`
3. `smart-ops-piperun-webhook`
4. `smart-ops-copilot`

Entre cada deploy, faço um `SELECT 1` para garantir que o pool continua saudável. Se latência subir, paro imediatamente.

### Etapa 7 — Relatório final
- Crons removidos: lista
- Função corrigida: OK/FAIL
- EFs redeployadas: lista
- Latência do pool: ms

---

## O que NÃO vou fazer
- Não vou reagendar `refresh_copilot_brain` nem `briefing`. Se você quiser esses crons de volta, é decisão separada com plano próprio (frequência maior, com kill-switch).
- Não vou reativar Realtime no frontend ainda — deixamos o `REALTIME_DISABLED_EMERGENCY = true` por 24h de observação.

Confirma o plano? Depois me diga "restaurado" que eu disparo tudo em sequência.