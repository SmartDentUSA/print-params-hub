
ALTER TABLE public.smartops_form_landing_pages
  ADD COLUMN IF NOT EXISTS content jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS hero_image_url text,
  ADD COLUMN IF NOT EXISTS content_version integer NOT NULL DEFAULT 1;
