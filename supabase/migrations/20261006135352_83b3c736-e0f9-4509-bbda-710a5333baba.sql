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
  SELECT j.jobid, j.jobname::text, j.schedule::text, j.active, left(j.command, 600)::text,
    (SELECT count(*) FROM cron.job_run_details d WHERE d.jobid=j.jobid AND d.start_time > now()-interval '24 hours'),
    (SELECT count(*) FROM cron.job_run_details d WHERE d.jobid=j.jobid AND d.start_time > now()-interval '24 hours' AND d.status='failed'),
    l.status::text, l.start_time, CASE WHEN l.status='failed' THEN left(l.return_message,500) END
  FROM cron.job j
  LEFT JOIN LATERAL (SELECT d.status, d.start_time, d.return_message FROM cron.job_run_details d
     WHERE d.jobid=j.jobid ORDER BY d.start_time DESC LIMIT 1) l ON true
  ORDER BY j.jobname;
END $$;

CREATE OR REPLACE FUNCTION public.admin_set_cron_active(p_jobname text, p_active boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, cron
AS $$
DECLARE v_id bigint;
BEGIN
  IF NOT (auth.role() = 'service_role' OR public.is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT jobid INTO v_id FROM cron.job WHERE jobname = p_jobname;
  IF v_id IS NULL THEN RAISE EXCEPTION 'rotina não encontrada'; END IF;
  PERFORM cron.alter_job(job_id := v_id, active := p_active);
  RETURN p_active;
END $$;

REVOKE ALL ON FUNCTION public.admin_list_cron_routines() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_cron_active(text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_cron_routines() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_set_cron_active(text, boolean) TO authenticated, service_role;