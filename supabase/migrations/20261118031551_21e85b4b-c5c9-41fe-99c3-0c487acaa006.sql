CREATE OR REPLACE FUNCTION public.fn_email_queue_status()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    'daily_cap',        399,
    'batches',          '[{"at":"07:30","size":100},{"at":"12:00","size":100},{"at":"15:00","size":100},{"at":"17:30","size":99}]'::jsonb,
    'queued_total',     (SELECT n FROM queued),
    'active_campaigns', (SELECT campaigns FROM queued),
    'window_start',     '07:30',
    'window_end',       '19:00'
  );
$function$;