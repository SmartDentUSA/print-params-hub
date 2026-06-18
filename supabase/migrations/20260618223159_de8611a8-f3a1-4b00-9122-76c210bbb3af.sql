
ALTER TABLE public.smartops_events
  ADD COLUMN IF NOT EXISTS about_event_pt text,
  ADD COLUMN IF NOT EXISTS about_event_en text,
  ADD COLUMN IF NOT EXISTS about_event_es text,
  ADD COLUMN IF NOT EXISTS cover_image_pt text,
  ADD COLUMN IF NOT EXISTS cover_image_en text,
  ADD COLUMN IF NOT EXISTS cover_image_es text,
  ADD COLUMN IF NOT EXISTS reference_image_url text,
  ADD COLUMN IF NOT EXISTS event_logo_url text,
  ADD COLUMN IF NOT EXISTS ai_image_prompt_pt text,
  ADD COLUMN IF NOT EXISTS ai_image_prompt_en text,
  ADD COLUMN IF NOT EXISTS ai_image_prompt_es text;
