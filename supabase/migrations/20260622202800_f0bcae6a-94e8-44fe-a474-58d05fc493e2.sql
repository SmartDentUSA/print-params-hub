
-- Public enrollment flags on courses
ALTER TABLE public.smartops_courses
  ADD COLUMN IF NOT EXISTS public_enrollment_enabled boolean NOT NULL DEFAULT false;

-- Enrollment provenance + client flag + raw form snapshot
ALTER TABLE public.smartops_course_enrollments
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'admin',
  ADD COLUMN IF NOT EXISTS is_client_smartdent boolean,
  ADD COLUMN IF NOT EXISTS public_form_payload jsonb;

-- NPS responses (3 stars + email + comment)
CREATE TABLE IF NOT EXISTS public.smartops_nps_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid REFERENCES public.smartops_course_enrollments(id) ON DELETE SET NULL,
  course_id uuid REFERENCES public.smartops_courses(id) ON DELETE SET NULL,
  lead_id uuid,
  email text,
  score_satisfacao smallint CHECK (score_satisfacao BETWEEN 1 AND 5),
  score_treinamentos smallint CHECK (score_treinamentos BETWEEN 1 AND 5),
  score_recomendacao smallint CHECK (score_recomendacao BETWEEN 1 AND 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.smartops_nps_responses TO authenticated;
GRANT ALL ON public.smartops_nps_responses TO service_role;

ALTER TABLE public.smartops_nps_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated read nps" ON public.smartops_nps_responses
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "service role manage nps" ON public.smartops_nps_responses
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_nps_enrollment ON public.smartops_nps_responses(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_nps_lead ON public.smartops_nps_responses(lead_id);
