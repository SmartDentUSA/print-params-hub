## Plano emergencial — cortar Realtime + corrigir `briefing_locks`

### 1. Desabilitar Realtime no frontend imediatamente

Alterar apenas `src/integrations/supabase/client.ts` para instalar um kill-switch global temporário no client Supabase:

- `supabase.channel()` passa a retornar um canal no-op.
- `.on(...).subscribe(...)` não abre websocket nem faz reconexão.
- `removeChannel`, `removeAllChannels` e `getChannels` viram no-op seguro.
- Não será necessário editar dezenas de componentes individualmente.
- Quando o banco estabilizar, basta remover/desligar o flag `REALTIME_DISABLED_EMERGENCY`.

Patch esperado:

```ts
const REALTIME_DISABLED_EMERGENCY = true;

if (REALTIME_DISABLED_EMERGENCY) {
  const noopChannel = {
    on: () => noopChannel,
    subscribe: (callback?: (status: string) => void) => {
      callback?.('CLOSED');
      return noopChannel;
    },
    unsubscribe: async () => 'ok',
  };

  (supabase as any).channel = () => noopChannel;
  (supabase as any).removeChannel = async () => 'ok';
  (supabase as any).removeAllChannels = async () => ['ok'];
  (supabase as any).getChannels = () => [];
}
```

### 2. Aplicar migration SQL solicitada

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

### 3. Verificação mínima

- Confirmar que a migration aplicou sem erro.
- Fazer um ping REST curto ao Supabase para verificar se o pool voltou a responder.
- Não reimplantar Edge Functions neste pedido, porque você pediu apenas desabilitar Realtime + aplicar migration.

### 4. Importante

Se a migration falhar por timeout (`SUPABASE_INTERNAL_ERROR` / `connection timeout`), o próximo passo é repetir assim que o Realtime do frontend estiver publicado e parar de reconectar.