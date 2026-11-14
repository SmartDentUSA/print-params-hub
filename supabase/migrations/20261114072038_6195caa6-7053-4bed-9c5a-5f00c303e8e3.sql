ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS lia_auto_reply boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.team_members.lia_auto_reply IS
  'Quando true, mensagens diretas recebidas por este número (webhook Evolution via evolution-webhook-fanout) são respondidas pela Dra. LIA a partir do próprio número.';

UPDATE public.team_members
   SET lia_auto_reply = true
 WHERE id = '406071b2-2bee-424c-a71f-5ffd023dad69';