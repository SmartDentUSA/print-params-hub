CREATE TABLE IF NOT EXISTS public.smartops_nps_demo_overrides (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL UNIQUE,
  lead_id uuid,
  force_next boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.smartops_nps_demo_overrides TO authenticated;
GRANT ALL ON public.smartops_nps_demo_overrides TO service_role;
ALTER TABLE public.smartops_nps_demo_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage nps demo overrides" ON public.smartops_nps_demo_overrides FOR ALL TO authenticated USING (true) WITH CHECK (true);