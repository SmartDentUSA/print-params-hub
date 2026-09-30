ALTER TABLE public.smartops_forms ADD COLUMN IF NOT EXISTS professional_lead_id uuid;
CREATE INDEX IF NOT EXISTS idx_smartops_forms_professional_lead ON public.smartops_forms(professional_lead_id) WHERE professional_lead_id IS NOT NULL;

ALTER TABLE public.professional_courses ADD COLUMN IF NOT EXISTS credenciamento_form_id uuid REFERENCES public.smartops_forms(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_professional_courses_credenciamento_form ON public.professional_courses(credenciamento_form_id) WHERE credenciamento_form_id IS NOT NULL;