ALTER TABLE public.live_group_blast_log
  ADD COLUMN IF NOT EXISTS send_uid text,
  ADD COLUMN IF NOT EXISTS dedupe_key text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'sent',
  ADD COLUMN IF NOT EXISTS scheduled_for timestamptz,
  ADD COLUMN IF NOT EXISTS error text;

UPDATE public.live_group_blast_log
SET dedupe_key = concat(automation_id::text, ':', turma_id::text, ':', kind),
    send_uid = COALESCE(send_uid, concat(kind, '-', to_char(COALESCE(sent_at, now()), 'YYYY-MM-DD'), '-', left(replace(id::text, '-', ''), 8)))
WHERE dedupe_key IS NULL OR send_uid IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS live_group_blast_log_dedupe_uidx
  ON public.live_group_blast_log (dedupe_key);
CREATE UNIQUE INDEX IF NOT EXISTS live_group_blast_log_send_uid_uidx
  ON public.live_group_blast_log (send_uid);