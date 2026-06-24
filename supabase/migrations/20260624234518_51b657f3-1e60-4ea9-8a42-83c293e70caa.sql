
-- 1. Tabela de fingerprints globais por grupo
CREATE TABLE IF NOT EXISTS public.wa_group_sent_fingerprints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_jid text NOT NULL,
  content_hash text NOT NULL,
  node_type text NOT NULL,
  last_sent_at timestamptz NOT NULL DEFAULT now(),
  last_campaign_id uuid,
  send_count integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wa_group_sent_fingerprints_unique UNIQUE (group_jid, content_hash)
);

CREATE INDEX IF NOT EXISTS idx_wa_group_sent_fp_group_time
  ON public.wa_group_sent_fingerprints (group_jid, last_sent_at DESC);

GRANT ALL ON public.wa_group_sent_fingerprints TO service_role;

ALTER TABLE public.wa_group_sent_fingerprints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role full access wa_group_sent_fingerprints"
  ON public.wa_group_sent_fingerprints
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 2. Janela configurável na campanha
ALTER TABLE public.wa_campaigns
  ADD COLUMN IF NOT EXISTS dedupe_window_days integer NOT NULL DEFAULT 30;

-- 3. Checagem de dedupe global
CREATE OR REPLACE FUNCTION public.fn_check_group_global_dedup(
  p_group_jid text,
  p_content_hash text,
  p_window_days integer DEFAULT 30
) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM public.wa_group_sent_fingerprints
    WHERE group_jid = p_group_jid
      AND content_hash = p_content_hash
      AND last_sent_at > now() - make_interval(days => GREATEST(p_window_days, 0))
  );
$$;

-- 4. Registro do envio (upsert atômico)
CREATE OR REPLACE FUNCTION public.fn_record_group_send(
  p_group_jid text,
  p_content_hash text,
  p_node_type text,
  p_campaign_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.wa_group_sent_fingerprints
    (group_jid, content_hash, node_type, last_sent_at, last_campaign_id, send_count)
  VALUES (p_group_jid, p_content_hash, p_node_type, now(), p_campaign_id, 1)
  ON CONFLICT (group_jid, content_hash) DO UPDATE
    SET last_sent_at     = now(),
        last_campaign_id = EXCLUDED.last_campaign_id,
        node_type        = EXCLUDED.node_type,
        send_count       = public.wa_group_sent_fingerprints.send_count + 1;
END;
$$;

-- 5. Backfill com os últimos 90 dias
INSERT INTO public.wa_group_sent_fingerprints
  (group_jid, content_hash, node_type, last_sent_at, last_campaign_id, send_count)
SELECT
  group_jid,
  md5(coalesce(node_type,'') || '|' || coalesce(content_json::text,'')),
  coalesce(node_type, 'msg'),
  max(sent_at),
  (array_agg(campaign_id ORDER BY sent_at DESC NULLS LAST))[1],
  count(*)
FROM public.wa_message_queue
WHERE status = 'sent'
  AND sent_at IS NOT NULL
  AND sent_at > now() - interval '90 days'
  AND group_jid IS NOT NULL
GROUP BY group_jid, md5(coalesce(node_type,'') || '|' || coalesce(content_json::text,'')), coalesce(node_type, 'msg')
ON CONFLICT (group_jid, content_hash) DO NOTHING;
