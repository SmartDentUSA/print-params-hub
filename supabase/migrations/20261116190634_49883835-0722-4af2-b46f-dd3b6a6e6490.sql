ALTER TABLE public.attendance_channel_events ADD COLUMN IF NOT EXISTS origin_channel text;

DROP POLICY IF EXISTS ace_public_insert ON public.attendance_channel_events;
CREATE POLICY ace_public_insert ON public.attendance_channel_events FOR INSERT TO anon, authenticated
  WITH CHECK (
    channel IN ('form','specialist','whatsapp_lia')
    AND event_type IN ('view','click','open','lead')
    AND (session_id IS NULL OR length(session_id) <= 120)
    AND (simulator_id IS NULL OR length(simulator_id) <= 80)
    AND (origin_channel IS NULL OR origin_channel IN ('email','sms','whatsapp','grupos','bio'))
  );

CREATE INDEX IF NOT EXISTS ace_form_origin_idx ON public.attendance_channel_events (form_id, origin_channel, created_at);

-- Origem dos cliques (e-mail, SMS, WhatsApp, grupos, Bio) de um formulário/landing.
CREATE OR REPLACE FUNCTION public.fn_attendance_origin_metrics(_form_id uuid, _since timestamptz DEFAULT now() - interval '90 days')
RETURNS TABLE(origin text, clicks bigint, views bigint, whatsapp_opens bigint, leads bigint, conversions bigint, revenue numeric)
LANGUAGE sql STABLE SET search_path = public AS $$
  WITH f AS (SELECT slug FROM smartops_forms WHERE id = _form_id),
  clk AS (
    SELECT coalesce(v.extra_data->>'origin', 'direto') AS origin, count(*) AS n
    FROM lead_page_views v, f
    WHERE v.page_path IN ('/lp/' || f.slug, '/f/' || f.slug)
      AND v.viewed_at >= _since AND v.utm_source = 'short_link'
    GROUP BY 1
  ),
  ev AS (
    SELECT e.*, coalesce(e.origin_channel, 'direto') AS o FROM attendance_channel_events e
    WHERE e.created_at >= _since AND e.form_id = _form_id
  ),
  lead_first AS (
    SELECT ev.o, ev.lead_id, min(ev.created_at) AS at FROM ev
    WHERE ev.event_type = 'lead' AND ev.lead_id IS NOT NULL GROUP BY 1,2
  ),
  won AS (
    SELECT lf.o, lf.lead_id, sum(d.value) AS v FROM lead_first lf
    JOIN deals d ON d.lead_id = lf.lead_id AND d.status = 'ganha'
     AND coalesce(d.closed_at, d.piperun_created_at, d.created_at) > lf.at
    GROUP BY 1,2
  ),
  origins AS (SELECT clk.origin FROM clk UNION SELECT DISTINCT ev.o FROM ev)
  SELECT o.origin,
    coalesce((SELECT clk.n FROM clk WHERE clk.origin = o.origin), 0),
    (SELECT count(*) FROM ev WHERE ev.o = o.origin AND ev.channel = 'form' AND ev.event_type = 'view'),
    (SELECT count(*) FROM ev WHERE ev.o = o.origin AND ev.channel = 'whatsapp_lia' AND ev.event_type = 'click'),
    (SELECT count(DISTINCT lf.lead_id) FROM lead_first lf WHERE lf.o = o.origin),
    (SELECT count(*) FROM won w WHERE w.o = o.origin),
    coalesce((SELECT sum(w.v) FROM won w WHERE w.o = o.origin), 0)
  FROM origins o
  WHERE auth.uid() IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.fn_attendance_origin_metrics(uuid, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_attendance_origin_metrics(uuid, timestamptz) TO authenticated, service_role;