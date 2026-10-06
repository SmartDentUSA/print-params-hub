ALTER TABLE public.email_flows
  ADD COLUMN IF NOT EXISTS priority integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS active_weekdays integer[] NOT NULL DEFAULT '{0,1,2,3,4,5,6}';

CREATE OR REPLACE FUNCTION public.fn_email_flow_claim(_limit integer DEFAULT 40)
RETURNS SETOF public.email_flow_enrollments LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE dow integer := extract(dow from (now() AT TIME ZONE 'America/Sao_Paulo'))::int;
BEGIN
  RETURN QUERY
  UPDATE email_flow_enrollments e SET next_run_at = now() + interval '10 minutes'
  WHERE e.id IN (
    SELECT x.id FROM email_flow_enrollments x JOIN email_flows f ON f.id = x.flow_id AND f.status = 'active' AND dow = ANY(f.active_weekdays)
    WHERE x.status = 'active' AND x.next_run_at <= now()
    ORDER BY f.priority ASC, x.next_run_at ASC LIMIT _limit FOR UPDATE OF x SKIP LOCKED)
  RETURNING e.*;
END $$;
REVOKE ALL ON FUNCTION public.fn_email_flow_claim(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_email_flow_claim(integer) TO service_role;