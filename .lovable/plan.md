## Recuperação do pool — fix `try_acquire_briefing_lock` + redeploy das 4 EFs

### Passo 1 — Migration (bloqueia o loop de duplicate key)

Aplicar via `supabase--migration`:

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

Isso elimina o `duplicate key` que estava reciclando conexões em loop. Como o pool está saturado, a migration pode falhar no primeiro tento — se ocorrer `SUPABASE_INTERNAL_ERROR / connection timeout`, aguardar 30–60s e reenviar até aplicar. Confirmar sucesso antes de qualquer redeploy.

### Passo 2 — Verificação do pool

Após a migration aplicada, testar responsividade REST com `curl` (< 3s). Se ainda travar, aguardar antes de seguir para o passo 3 (redeploys reabrem conexões).

### Passo 3 — Redeploy das 4 Edge Functions (nesta ordem)

Usar `supabase--deploy_edge_functions` com `["smart-ops-piperun-webhook","smart-ops-copilot","enrichment-safety-net-cron","smart-ops-lia-assign"]`.

Ordem escolhida deliberadamente: `smart-ops-lia-assign` por último (é a maior consumidora de conexões — o pool precisa estar estável antes dela subir).

Código-fonte das 4 já verificado íntegro no repositório em turnos anteriores; nenhum arquivo será editado neste plano — apenas redeploy do que já existe.

### Passo 4 — Validação pós-redeploy

- `supabase--edge_function_logs` em `smart-ops-lia-assign` filtrando `duplicate key` / `briefing_locks` para confirmar zero ocorrências.
- `supabase--read_query`: `SELECT count(*) FROM public.enrichment_safety_queue WHERE processed_at IS NULL` — deve começar a decrescer nos minutos seguintes com o safety-net-cron ativo.
- `supabase--edge_function_logs` em `enrichment-safety-net-cron` para confirmar reprocessamento.

### Observações

- **Não** re-agendo os crons `refresh_copilot_brain` / `briefing` — permanecem `unschedule`d conforme decisão anterior. Reativar só após inspeção manual da lógica que os disparava.
- Nenhum arquivo do repositório será modificado — este plano é 100% infraestrutura (SQL + redeploy).
- Se o pool não responder após 5 minutos mesmo com a migration aplicada, escalar para reboot do projeto no Dashboard Supabase (Settings → General → Restart project) — última opção.
