ALTER TABLE public.knowledge_gap_drafts
  ADD COLUMN IF NOT EXISTS ai_model_used text DEFAULT 'gemini',
  ADD COLUMN IF NOT EXISTS draft_faq_ds jsonb,
  ADD COLUMN IF NOT EXISTS draft_title_ds text,
  ADD COLUMN IF NOT EXISTS draft_excerpt_ds text;