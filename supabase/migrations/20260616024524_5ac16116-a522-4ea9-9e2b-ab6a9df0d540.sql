CREATE TABLE public.smartops_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  country TEXT,
  start_date DATE,
  end_date DATE,
  location TEXT,
  company_stand TEXT,
  website_url TEXT,
  cover_image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.smartops_events TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.smartops_events TO authenticated;
GRANT ALL ON public.smartops_events TO service_role;

ALTER TABLE public.smartops_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view active events"
  ON public.smartops_events FOR SELECT
  USING (is_active = true OR public.get_user_role(auth.uid()) = 'admin'::app_role);

CREATE POLICY "Admins can insert events"
  ON public.smartops_events FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role(auth.uid()) = 'admin'::app_role);

CREATE POLICY "Admins can update events"
  ON public.smartops_events FOR UPDATE
  TO authenticated
  USING (public.get_user_role(auth.uid()) = 'admin'::app_role)
  WITH CHECK (public.get_user_role(auth.uid()) = 'admin'::app_role);

CREATE POLICY "Admins can delete events"
  ON public.smartops_events FOR DELETE
  TO authenticated
  USING (public.get_user_role(auth.uid()) = 'admin'::app_role);

CREATE TRIGGER trg_smartops_events_updated_at
  BEFORE UPDATE ON public.smartops_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_smartops_events_active_date
  ON public.smartops_events (is_active, start_date);