ALTER TABLE public.training_testimonials
  ADD COLUMN IF NOT EXISTS article_drive_file_id text,
  ADD COLUMN IF NOT EXISTS article_drive_web_view_link text,
  ADD COLUMN IF NOT EXISTS article_drive_synced_at timestamptz;