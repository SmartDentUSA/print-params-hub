ALTER TABLE public.whatsapp_inbox
  ADD COLUMN IF NOT EXISTS instance_name text,
  ADD COLUMN IF NOT EXISTS team_member_id uuid,
  ADD COLUMN IF NOT EXISTS wa_message_id text,
  ADD COLUMN IF NOT EXISTS is_group boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sender_name text,
  ADD COLUMN IF NOT EXISTS remote_jid text;

CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_inbox_instance_msg_uidx
  ON public.whatsapp_inbox (instance_name, wa_message_id)
  WHERE wa_message_id IS NOT NULL AND instance_name IS NOT NULL;

CREATE INDEX IF NOT EXISTS whatsapp_inbox_instance_created_idx
  ON public.whatsapp_inbox (instance_name, created_at DESC);

CREATE INDEX IF NOT EXISTS whatsapp_inbox_team_member_idx
  ON public.whatsapp_inbox (team_member_id);
