
CREATE TABLE public.smartops_form_landing_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL UNIQUE REFERENCES public.smartops_forms(id) ON DELETE CASCADE,
  mode text NOT NULL CHECK (mode IN ('ai','briefing')),
  input_prompt text,
  generated_html text,
  theme jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.smartops_form_landing_pages TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.smartops_form_landing_pages TO authenticated;
GRANT ALL ON public.smartops_form_landing_pages TO service_role;

ALTER TABLE public.smartops_form_landing_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage landing pages"
  ON public.smartops_form_landing_pages
  FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Public can read published landing pages"
  ON public.smartops_form_landing_pages
  FOR SELECT
  TO anon, authenticated
  USING (status = 'published');

CREATE TRIGGER update_smartops_form_landing_pages_updated_at
  BEFORE UPDATE ON public.smartops_form_landing_pages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
