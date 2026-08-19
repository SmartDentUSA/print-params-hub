ALTER TABLE public.training_testimonials
  ADD COLUMN IF NOT EXISTS social_story_status text,
  ADD COLUMN IF NOT EXISTS social_story_post_id uuid,
  ADD COLUMN IF NOT EXISTS social_story_error text,
  ADD COLUMN IF NOT EXISTS social_story_published_at timestamptz,
  ADD COLUMN IF NOT EXISTS social_story_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS social_story_snapshot jsonb;