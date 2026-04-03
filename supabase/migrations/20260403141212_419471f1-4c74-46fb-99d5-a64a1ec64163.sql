
-- Table: lead_page_views
CREATE TABLE public.lead_page_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  lead_id uuid REFERENCES public.lia_attendances(id) ON DELETE SET NULL,
  page_path text NOT NULL,
  page_title text,
  page_type text,
  referrer text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  device_type text,
  browser text,
  ip_hash text,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_lead_page_views_lead_id ON public.lead_page_views(lead_id);
CREATE INDEX idx_lead_page_views_session ON public.lead_page_views(session_id);
CREATE INDEX idx_lead_page_views_viewed_at ON public.lead_page_views(viewed_at DESC);
CREATE INDEX idx_lead_page_views_page_path ON public.lead_page_views(page_path);

-- RLS
ALTER TABLE public.lead_page_views ENABLE ROW LEVEL SECURITY;

-- Public insert (anonymous tracking)
CREATE POLICY "Allow anonymous insert" ON public.lead_page_views
  FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Admin select
CREATE POLICY "Admins can read page views" ON public.lead_page_views
  FOR SELECT TO authenticated
  USING (public.has_panel_access(auth.uid()));

-- Function to link anonymous page views to a lead retroactively
CREATE OR REPLACE FUNCTION public.fn_link_page_views_to_lead(p_session_id text, p_lead_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  rows_updated integer;
BEGIN
  UPDATE lead_page_views
  SET lead_id = p_lead_id
  WHERE session_id = p_session_id
    AND lead_id IS NULL;
  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  RETURN rows_updated;
END;
$$;
