
ALTER TABLE public.smartops_form_landing_pages
  ADD COLUMN IF NOT EXISTS editor_state jsonb NOT NULL DEFAULT '{}'::jsonb;
