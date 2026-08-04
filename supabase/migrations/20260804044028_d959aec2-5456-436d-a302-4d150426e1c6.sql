ALTER TABLE public.training_testimonials
  ADD COLUMN IF NOT EXISTS pandavideo_id text,
  ADD COLUMN IF NOT EXISTS pandavideo_external_id text,
  ADD COLUMN IF NOT EXISTS panda_folder_id text,
  ADD COLUMN IF NOT EXISTS panda_folder_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS video_player text,
  ADD COLUMN IF NOT EXISTS video_hls text,
  ADD COLUMN IF NOT EXISTS thumbnail_url text,
  ADD COLUMN IF NOT EXISTS video_conversion_status text,
  ADD COLUMN IF NOT EXISTS video_title text,
  ADD COLUMN IF NOT EXISTS video_description text,
  ADD COLUMN IF NOT EXISTS panda_uploaded_at timestamptz,
  ADD COLUMN IF NOT EXISTS panda_last_error text;

CREATE UNIQUE INDEX IF NOT EXISTS uq_training_testimonials_drive_file
  ON public.training_testimonials (drive_file_id)
  WHERE drive_file_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_training_testimonials_panda_video
  ON public.training_testimonials (pandavideo_id)
  WHERE pandavideo_id IS NOT NULL;