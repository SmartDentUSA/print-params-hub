ALTER TABLE public.smartops_forms
  ADD COLUMN IF NOT EXISTS capture_buttons_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS capture_buttons jsonb NOT NULL DEFAULT '[]'::jsonb;