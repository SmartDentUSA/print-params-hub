DELETE FROM cron.job_run_details WHERE start_time < now() - interval '3 days';

CREATE OR REPLACE FUNCTION public.admin_list_cron_routines()
RETURNS TABLE(jobid bigint, jobname text, schedule text, active boolean, command text,
  runs_24h bigint, failures_24h bigint, last_status text, last_run timestamptz, last_error text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, cron
AS $$
BEGIN
  IF NOT (auth.role() = 'service_role' OR public.is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
  WITH recent AS (
    SELECT d.jobid, d.status, d.start_time, d.return_message
    FROM cron.job_run_details d WHERE d.start_time > now() - interval '24 hours'
  ), agg AS (
    SELECT r.jobid, count(*) AS runs, count(*) FILTER (WHERE r.status='failed') AS fails
    FROM recent r GROUP BY r.jobid
  ), last AS (
    SELECT DISTINCT ON (r.jobid) r.jobid, r.status, r.start_time, r.return_message
    FROM recent r ORDER BY r.jobid, r.start_time DESC
  )
  SELECT j.jobid, j.jobname::text, j.schedule::text, j.active, left(j.command, 600)::text,
    coalesce(a.runs,0), coalesce(a.fails,0),
    l.status::text, l.start_time, CASE WHEN l.status='failed' THEN left(l.return_message,500) END
  FROM cron.job j
  LEFT JOIN agg a ON a.jobid=j.jobid
  LEFT JOIN last l ON l.jobid=j.jobid
  ORDER BY j.jobname;
END $$;

SELECT cron.unschedule('cron-history-cleanup') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='cron-history-cleanup');
SELECT cron.schedule('cron-history-cleanup', '17 3 * * *', $$DELETE FROM cron.job_run_details WHERE start_time < now() - interval '3 days'$$);