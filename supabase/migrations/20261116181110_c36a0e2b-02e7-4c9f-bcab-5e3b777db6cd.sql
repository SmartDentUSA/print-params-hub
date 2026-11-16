ALTER TABLE public.smartops_form_landing_pages
  ADD COLUMN IF NOT EXISTS custom_html text,
  ADD COLUMN IF NOT EXISTS custom_simulators jsonb;

ALTER TABLE public.attendance_channel_events ADD COLUMN IF NOT EXISTS simulator_id text;

DROP POLICY IF EXISTS ace_public_insert ON public.attendance_channel_events;
CREATE POLICY ace_public_insert ON public.attendance_channel_events FOR INSERT TO anon, authenticated
  WITH CHECK (
    channel IN ('form','specialist','whatsapp_lia')
    AND event_type IN ('view','click','open','lead')
    AND (session_id IS NULL OR length(session_id) <= 120)
    AND (simulator_id IS NULL OR length(simulator_id) <= 80)
  );

CREATE INDEX IF NOT EXISTS ace_form_simulator_idx ON public.attendance_channel_events (form_id, simulator_id, created_at) WHERE simulator_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.fn_attendance_simulator_metrics(_form_id uuid, _since timestamptz DEFAULT now() - interval '90 days')
RETURNS TABLE(simulator_id text, views bigint, leads bigint, conversions bigint, revenue numeric)
LANGUAGE sql STABLE SET search_path = public AS $$
  WITH ev AS (
    SELECT e.* FROM attendance_channel_events e
    WHERE e.created_at >= _since AND e.form_id = _form_id
      AND e.channel = 'whatsapp_lia' AND e.simulator_id IS NOT NULL
  ),
  lead_first AS (
    SELECT ev.simulator_id, ev.lead_id, min(ev.created_at) AS at FROM ev
    WHERE ev.event_type = 'lead' AND ev.lead_id IS NOT NULL GROUP BY 1,2
  ),
  won AS (
    SELECT lf.simulator_id, lf.lead_id, sum(d.value) AS v FROM lead_first lf
    JOIN deals d ON d.lead_id = lf.lead_id AND d.status = 'ganha'
     AND coalesce(d.closed_at, d.piperun_created_at, d.created_at) > lf.at
    GROUP BY 1,2
  ),
  sims AS (SELECT DISTINCT ev.simulator_id FROM ev)
  SELECT s.simulator_id,
    (SELECT count(*) FROM ev WHERE ev.simulator_id = s.simulator_id AND ev.event_type IN ('view','click','open')),
    (SELECT count(*) FROM lead_first lf WHERE lf.simulator_id = s.simulator_id),
    (SELECT count(*) FROM won w WHERE w.simulator_id = s.simulator_id),
    coalesce((SELECT sum(w.v) FROM won w WHERE w.simulator_id = s.simulator_id), 0)
  FROM sims s
  WHERE auth.uid() IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.fn_attendance_simulator_metrics(uuid, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_attendance_simulator_metrics(uuid, timestamptz) TO authenticated, service_role;