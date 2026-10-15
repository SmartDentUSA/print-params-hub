alter table public.professional_courses
  add column if not exists reels_pandavideo_id text,
  add column if not exists reels_storage_path text,
  add column if not exists reels_social_status text,
  add column if not exists reels_social_post_id uuid,
  add column if not exists reels_social_error text,
  add column if not exists reels_social_snapshot jsonb,
  add column if not exists reels_social_published_at timestamptz,
  add column if not exists ig_trigger_keyword text,
  add column if not exists reels_flow_id uuid;