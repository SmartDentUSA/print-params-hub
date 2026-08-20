ALTER TABLE public.knowledge_contents
  ADD COLUMN IF NOT EXISTS content_modernized_at timestamptz,
  ADD COLUMN IF NOT EXISTS faqs_aeo_at timestamptz;