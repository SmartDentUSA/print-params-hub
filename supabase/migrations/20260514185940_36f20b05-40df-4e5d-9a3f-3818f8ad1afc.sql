CREATE TABLE public.campaign_segments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  lead_count integer DEFAULT 0,
  lead_ids uuid[] DEFAULT '{}'::uuid[],
  last_refreshed_at timestamptz,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.campaign_segments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage campaign_segments"
  ON public.campaign_segments
  FOR ALL
  USING (is_admin((SELECT auth.uid())))
  WITH CHECK (is_admin((SELECT auth.uid())));

CREATE POLICY "campaign_segments_service"
  ON public.campaign_segments
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_campaign_segments_created_at ON public.campaign_segments(created_at DESC);

CREATE TRIGGER set_campaign_segments_updated_at
  BEFORE UPDATE ON public.campaign_segments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();