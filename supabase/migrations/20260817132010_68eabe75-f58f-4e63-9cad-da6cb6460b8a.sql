ALTER TABLE public.smartops_forms
  ADD COLUMN IF NOT EXISTS bio_enabled_form boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bio_enabled_landing boolean NOT NULL DEFAULT false;