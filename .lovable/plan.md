## Objetivo

Auto-fallback no dispatcher: quando detecta `SessionError: No sessions` em grupo usando per-instance key, tenta com a global, e se funcionar marca `evolution_group_key_broken_at` no team_member. Próximos envios em grupo daquele team_member usam direto a global; mensagens individuais continuam com a per-instance.

---

## Migrations

### Migration 1 — colunas novas + CHECK ampliado

```sql
ALTER TABLE team_members
  ADD COLUMN evolution_group_key_broken_at timestamptz NULL;

ALTER TABLE wa_groups
  ADD COLUMN session_health text NOT NULL DEFAULT 'ok',
  ADD COLUMN consecutive_send_errors int NOT NULL DEFAULT 0,
  ADD COLUMN last_send_error text,
  ADD COLUMN last_send_error_at timestamptz;

-- Ampliar CHECK ANTES de qualquer UPDATE com 'blocked_session'
ALTER TABLE wa_message_queue
  DROP CONSTRAINT IF EXISTS wa_message_queue_status_check;

ALTER TABLE wa_message_queue
  ADD CONSTRAINT wa_message_queue_status_check
  CHECK (status IN ('pending','sending','sent','failed','skipped','blocked_session'));
```

### Migration 2 — RPC `fn_wa_reactivate_group`

```sql
CREATE OR REPLACE FUNCTION public.fn_wa_reactivate_group(p_group_jid text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_released int;
BEGIN
  UPDATE wa_groups
     SET session_health='ok', consecutive_send_errors=0,
         last_send_error=NULL, last_send_error_at=NULL
   WHERE group_jid = p_group_jid;

  WITH upd AS (
    UPDATE wa_message_queue
       SET status='pending', scheduled_at = now() + interval '10 seconds'
     WHERE group_jid = p_group_jid AND status='blocked_session'
    RETURNING 1
  )
  SELECT count(*) INTO v_released FROM upd;

  RETURN jsonb_build_object('released', v_released);
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_wa_reactivate_group(text) TO authenticated, service_role;
```

---

## Código

### `supabase/functions/_shared/evolution.ts`

```ts
export function resolveApiKey(opts: {
  teamMember?: { evolution_api_key?: string | null; evolution_group_key_broken_at?: string | null } | null;
  isGroup: boolean;
}): string {
  const GLOBAL = Deno.env.get('EVOLUTION_API_KEY') ?? 'SmartDent_LIA_2026';
  if (!opts.teamMember) return GLOBAL;
  if (opts.isGroup && opts.teamMember.evolution_group_key_broken_at) return GLOBAL;
  return opts.teamMember.evolution_api_key || GLOBAL;
}
```

Também exportar a constante `GLOBAL_EVOLUTION_KEY` para o dispatcher comparar `key === GLOBAL`.

### `supabase/functions/wa-dispatcher/index.ts`

1. Lookup expandido:
   ```ts
   .select('id, evolution_instance_name, evolution_api_key, evolution_group_key_broken_at')
   ```
2. `teamMemberByInstance: Map<string, { id, evolution_api_key, evolution_group_key_broken_at }>`
3. Ao processar item de grupo (`group_jid.endsWith('@g.us')`):
   - `key = resolveApiKey({ teamMember, isGroup: true })`
   - tenta envio
   - sucesso → `sent`, zera `consecutive_send_errors`, `session_health='ok'`
   - erro `/SessionError|No sessions/i`:
     - se `key !== GLOBAL_EVOLUTION_KEY` → retry síncrono 1× com GLOBAL
       - sucesso: `UPDATE team_members SET evolution_group_key_broken_at=now() WHERE id=$1 AND evolution_group_key_broken_at IS NULL`; log warning em `system_health_logs`; marca `sent`
       - falha: incrementa `consecutive_send_errors`; se ≥2 → `session_health='session_broken'` + `UPDATE wa_message_queue SET status='blocked_session' WHERE group_jid=$1 AND status='pending'`
     - se `key === GLOBAL`: mesma escalada de 2-falhas → bloqueia grupo
4. Antes do envio: skipar item se `wa_groups.session_health='session_broken'`.

### Frontend

- `WaCampaignHealthBadge.tsx`: badge 🟢 ok / 🔴 "Sessão WhatsApp quebrada" com tooltip mostrando `last_send_error` + horário.
- `SmartOpsWaGroupCampaigns.tsx`: quando `session_health='session_broken'`, botão **Reativar grupo** → `supabase.rpc('fn_wa_reactivate_group', { p_group_jid })` + toast com contagem + invalidação de query.
- Indicador discreto "🔧 Auto-fallback ativo" quando o team_member do owner do grupo tem `evolution_group_key_broken_at != null`.

### Memory

Atualizar `mem://integration/evolution-per-instance-credentials`: per-instance key pode quebrar especificamente para JIDs de grupo; dispatcher faz retry síncrono com `EVOLUTION_API_KEY` global e marca `team_members.evolution_group_key_broken_at`.

---

## Fora de escopo

Polling de `/instance/connectionState`, restart automático de instância, webhooks de estado do Evolution.
