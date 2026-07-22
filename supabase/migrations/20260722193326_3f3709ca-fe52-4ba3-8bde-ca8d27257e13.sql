
-- 1) Lead-level bounce flags & last email attempt
ALTER TABLE public.lia_attendances
  ADD COLUMN IF NOT EXISTS email_bounced boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_bounced_at timestamptz,
  ADD COLUMN IF NOT EXISTS email_bounced_reason text,
  ADD COLUMN IF NOT EXISTS email_last_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS email_last_attempt_status text;

CREATE INDEX IF NOT EXISTS idx_lia_attendances_email_bounced
  ON public.lia_attendances (email_bounced)
  WHERE email_bounced = true;

-- 2) Campaign send log: bounce detail
ALTER TABLE public.campaign_send_log
  ADD COLUMN IF NOT EXISTS bounced_at timestamptz,
  ADD COLUMN IF NOT EXISTS bounce_reason text;

-- 3) Aggregation RPC for the History UI (queued + sent + opens + clicks + bounces)
CREATE OR REPLACE FUNCTION public.fn_campaign_email_stats(p_campaign_id uuid)
RETURNS TABLE (
  total       bigint,
  queued      bigint,
  sent        bigint,
  failed      bigint,
  bounced     bigint,
  opened      bigint,
  clicked     bigint,
  last_attempt_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    count(*)                                                            AS total,
    count(*) FILTER (WHERE status = 'queued')                           AS queued,
    count(*) FILTER (WHERE status IN ('sent','delivered'))              AS sent,
    count(*) FILTER (WHERE status = 'error' OR status = 'failed')       AS failed,
    count(*) FILTER (WHERE status = 'bounced' OR bounced_at IS NOT NULL) AS bounced,
    count(*) FILTER (WHERE opened_at IS NOT NULL)                       AS opened,
    count(*) FILTER (WHERE clicked_at IS NOT NULL)                      AS clicked,
    max(coalesce(sent_at, bounced_at, created_at))                       AS last_attempt_at
  FROM public.campaign_send_log
  WHERE source_campaign_id = p_campaign_id
     OR campaign_id = p_campaign_id;
$$;

GRANT EXECUTE ON FUNCTION public.fn_campaign_email_stats(uuid) TO authenticated, service_role;
