ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS lia_slug text, ADD COLUMN IF NOT EXISTS lia_opening_message text, ADD COLUMN IF NOT EXISTS lia_product_name text;
CREATE UNIQUE INDEX IF NOT EXISTS campaigns_lia_slug_uq ON public.campaigns (lower(lia_slug)) WHERE lia_slug IS NOT NULL;

CREATE TABLE public.attendance_channel_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel text NOT NULL,
  event_type text NOT NULL,
  form_id uuid,
  campaign_slug text,
  product_name text,
  lead_id uuid,
  session_id text,
  page_path text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.attendance_channel_events TO anon;
GRANT SELECT, INSERT ON public.attendance_channel_events TO authenticated;
GRANT ALL ON public.attendance_channel_events TO service_role;
ALTER TABLE public.attendance_channel_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY ace_public_insert ON public.attendance_channel_events FOR INSERT TO anon, authenticated
  WITH CHECK (channel IN ('form','specialist','whatsapp_lia') AND event_type IN ('view','click','open','lead') AND (session_id IS NULL OR length(session_id) <= 120));
CREATE POLICY ace_auth_read ON public.attendance_channel_events FOR SELECT TO authenticated USING (true);
CREATE INDEX ace_form_idx ON public.attendance_channel_events (form_id, channel, created_at);
CREATE INDEX ace_campaign_idx ON public.attendance_channel_events (campaign_slug, channel, created_at);
CREATE INDEX ace_lead_idx ON public.attendance_channel_events (lead_id) WHERE lead_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.fn_attendance_channel_metrics(_form_id uuid DEFAULT NULL, _campaign_slug text DEFAULT NULL, _since timestamptz DEFAULT now() - interval '90 days')
RETURNS TABLE(channel text, views bigint, leads bigint, conversions bigint, revenue numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH ev AS (
    SELECT * FROM attendance_channel_events e
    WHERE e.created_at >= _since
      AND (_form_id IS NULL OR e.form_id = _form_id)
      AND (_campaign_slug IS NULL OR lower(e.campaign_slug) = lower(_campaign_slug))
  ),
  ch AS (SELECT unnest(ARRAY['form','specialist','whatsapp_lia']) AS channel),
  lead_first AS (
    SELECT ev.channel, ev.lead_id, min(ev.created_at) AS at FROM ev
    WHERE ev.event_type = 'lead' AND ev.lead_id IS NOT NULL GROUP BY 1,2
  ),
  won AS (
    SELECT lf.channel, lf.lead_id, sum(d.value) AS v FROM lead_first lf
    JOIN deals d ON d.lead_id = lf.lead_id AND d.status = 'ganha'
     AND coalesce(d.closed_at, d.piperun_created_at, d.created_at) > lf.at
    GROUP BY 1,2
  )
  SELECT ch.channel,
    (SELECT count(*) FROM ev WHERE ev.channel = ch.channel AND ev.event_type IN ('view','click','open')),
    (SELECT count(*) FROM lead_first lf WHERE lf.channel = ch.channel),
    (SELECT count(*) FROM won w WHERE w.channel = ch.channel),
    coalesce((SELECT sum(w.v) FROM won w WHERE w.channel = ch.channel), 0)
  FROM ch
  WHERE auth.uid() IS NOT NULL;
$$;
REVOKE ALL ON FUNCTION public.fn_attendance_channel_metrics(uuid,text,timestamptz) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.fn_attendance_channel_metrics(uuid,text,timestamptz) TO authenticated;