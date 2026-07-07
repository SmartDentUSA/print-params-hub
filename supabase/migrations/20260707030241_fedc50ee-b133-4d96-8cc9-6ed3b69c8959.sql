-- 1) campaign scheduling window
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS send_window_start time NOT NULL DEFAULT '07:30',
  ADD COLUMN IF NOT EXISTS send_window_end   time NOT NULL DEFAULT '19:00',
  ADD COLUMN IF NOT EXISTS daily_cap         integer NOT NULL DEFAULT 499;

-- 2) indexes
CREATE INDEX IF NOT EXISTS idx_campaign_send_log_queued
  ON public.campaign_send_log (campaign_id, created_at)
  WHERE status = 'queued';

CREATE INDEX IF NOT EXISTS idx_campaign_send_log_gmail_sent
  ON public.campaign_send_log (sent_at)
  WHERE provider = 'gmail' AND status = 'sent';

-- 3) metrics RPC
CREATE OR REPLACE FUNCTION public.fn_email_campaign_metrics(p_campaign_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'total',       count(*) FILTER (WHERE campaign_id = p_campaign_id),
    'enviados',    count(*) FILTER (WHERE campaign_id = p_campaign_id AND status = 'sent'),
    'pendentes',   count(*) FILTER (WHERE campaign_id = p_campaign_id AND status = 'queued'),
    'erros',       count(*) FILTER (WHERE campaign_id = p_campaign_id AND status = 'error'),
    'abertos',     count(*) FILTER (WHERE campaign_id = p_campaign_id AND opened_at IS NOT NULL),
    'clicks',      count(*) FILTER (WHERE campaign_id = p_campaign_id AND clicked_at IS NOT NULL),
    'click_total', coalesce(sum(click_count) FILTER (WHERE campaign_id = p_campaign_id), 0),
    'taxa_abertura', CASE WHEN count(*) FILTER (WHERE campaign_id = p_campaign_id AND status = 'sent') = 0 THEN 0
                          ELSE round(100.0 * count(*) FILTER (WHERE campaign_id = p_campaign_id AND opened_at IS NOT NULL)
                                    / count(*) FILTER (WHERE campaign_id = p_campaign_id AND status = 'sent'), 2)
                     END,
    'taxa_click',    CASE WHEN count(*) FILTER (WHERE campaign_id = p_campaign_id AND status = 'sent') = 0 THEN 0
                          ELSE round(100.0 * count(*) FILTER (WHERE campaign_id = p_campaign_id AND clicked_at IS NOT NULL)
                                    / count(*) FILTER (WHERE campaign_id = p_campaign_id AND status = 'sent'), 2)
                     END
  )
  FROM public.campaign_send_log
  WHERE campaign_id = p_campaign_id;
$$;

GRANT EXECUTE ON FUNCTION public.fn_email_campaign_metrics(uuid) TO anon, authenticated, service_role;

-- 4) global queue summary RPC (used by wizard step 4 UI)
CREATE OR REPLACE FUNCTION public.fn_email_queue_status()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH sent_today AS (
    SELECT count(*)::int AS n
    FROM public.campaign_send_log
    WHERE provider = 'gmail'
      AND status = 'sent'
      AND (sent_at AT TIME ZONE 'America/Sao_Paulo')::date
        = (now()  AT TIME ZONE 'America/Sao_Paulo')::date
  ),
  queued AS (
    SELECT count(*)::int AS n,
           count(DISTINCT campaign_id)::int AS campaigns
    FROM public.campaign_send_log
    WHERE status = 'queued'
  )
  SELECT jsonb_build_object(
    'sent_today',       (SELECT n FROM sent_today),
    'daily_cap',        499,
    'queued_total',     (SELECT n FROM queued),
    'active_campaigns', (SELECT campaigns FROM queued),
    'window_start',     '07:30',
    'window_end',       '19:00'
  );
$$;

GRANT EXECUTE ON FUNCTION public.fn_email_queue_status() TO anon, authenticated, service_role;