CREATE TABLE IF NOT EXISTS public.social_dm_sent_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL DEFAULT 'instagram',
  recipient_id text NOT NULL,
  dedup_key text NOT NULL,
  message_hash text NOT NULL,
  source text,
  message_preview text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS social_dm_sent_log_dedup_uidx
  ON public.social_dm_sent_log (dedup_key);
CREATE INDEX IF NOT EXISTS social_dm_sent_log_recipient_idx
  ON public.social_dm_sent_log (recipient_id, created_at DESC);

GRANT ALL ON public.social_dm_sent_log TO service_role;

ALTER TABLE public.social_dm_sent_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role manages dm sent log"
  ON public.social_dm_sent_log FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.try_claim_social_dm(
  _platform text,
  _recipient_id text,
  _message_hash text,
  _source text DEFAULT NULL,
  _window_minutes integer DEFAULT 10,
  _message_preview text DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _key text;
  _bucket bigint;
BEGIN
  _bucket := floor(extract(epoch from now()) / (greatest(_window_minutes, 1) * 60));
  _key := _platform || ':' || _recipient_id || ':' || _message_hash || ':' || _bucket::text;

  DELETE FROM public.social_dm_sent_log WHERE created_at < now() - interval '30 days';

  BEGIN
    INSERT INTO public.social_dm_sent_log (platform, recipient_id, dedup_key, message_hash, source, message_preview)
    VALUES (_platform, _recipient_id, _key, _message_hash, _source, left(coalesce(_message_preview, ''), 300));
    RETURN true;
  EXCEPTION WHEN unique_violation THEN
    RETURN false;
  END;
END;
$$;