ALTER TABLE public.smartops_forms
  ADD COLUMN IF NOT EXISTS heading_color text,
  ADD COLUMN IF NOT EXISTS body_color text,
  ADD COLUMN IF NOT EXISTS label_color text,
  ADD COLUMN IF NOT EXISTS muted_color text,
  ADD COLUMN IF NOT EXISTS auto_contrast boolean NOT NULL DEFAULT true;