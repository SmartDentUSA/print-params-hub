ALTER TABLE public.smartops_events
  ADD COLUMN IF NOT EXISTS audience_areas text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS audience_specialties text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS audience_notes text;