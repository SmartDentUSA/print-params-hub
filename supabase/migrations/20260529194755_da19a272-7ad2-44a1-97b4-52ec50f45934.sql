-- Auto-fallback de chave Evolution para grupos: colunas + CHECK ampliado + RPC reactivate

ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS evolution_group_key_broken_at timestamptz NULL;

ALTER TABLE public.wa_groups
  ADD COLUMN IF NOT EXISTS session_health text NOT NULL DEFAULT 'ok',
  ADD COLUMN IF NOT EXISTS consecutive_send_errors int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_send_error text,
  ADD COLUMN IF NOT EXISTS last_send_error_at timestamptz;

ALTER TABLE public.wa_message_queue
  DROP CONSTRAINT IF EXISTS wa_message_queue_status_check;

ALTER TABLE public.wa_message_queue
  ADD CONSTRAINT wa_message_queue_status_check
  CHECK (status IN ('pending','sending','sent','failed','skipped','blocked_session'));

CREATE OR REPLACE FUNCTION public.fn_wa_reactivate_group(p_group_jid text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_released int;
BEGIN
  UPDATE wa_groups
     SET session_health='ok',
         consecutive_send_errors=0,
         last_send_error=NULL,
         last_send_error_at=NULL
   WHERE group_jid = p_group_jid;

  WITH upd AS (
    UPDATE wa_message_queue
       SET status='pending',
           scheduled_at = now() + interval '10 seconds',
           error_message = NULL
     WHERE group_jid = p_group_jid AND status='blocked_session'
    RETURNING 1
  )
  SELECT count(*) INTO v_released FROM upd;

  RETURN jsonb_build_object('released', v_released);
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_wa_reactivate_group(text) TO authenticated, service_role;