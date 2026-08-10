ALTER TABLE public.smartops_nps_responses
  ADD COLUMN IF NOT EXISTS survey_type text NOT NULL DEFAULT 'pos_treinamento';

UPDATE public.smartops_nps_responses SET survey_type = 'pos_treinamento' WHERE survey_type IS NULL;

CREATE INDEX IF NOT EXISTS idx_nps_responses_survey_type_course
  ON public.smartops_nps_responses (survey_type, course_id, created_at DESC);