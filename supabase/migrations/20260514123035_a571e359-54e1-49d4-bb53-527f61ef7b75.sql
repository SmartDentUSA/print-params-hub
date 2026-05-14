ALTER TABLE public.smartops_forms
  ADD COLUMN IF NOT EXISTS display_mode text NOT NULL DEFAULT 'list',
  ADD COLUMN IF NOT EXISTS show_progress boolean NOT NULL DEFAULT true;

ALTER TABLE public.smartops_forms
  DROP CONSTRAINT IF EXISTS smartops_forms_display_mode_check;

ALTER TABLE public.smartops_forms
  ADD CONSTRAINT smartops_forms_display_mode_check
  CHECK (display_mode IN ('list','step'));