ALTER TABLE public.social_scheduled_posts
  ADD COLUMN IF NOT EXISTS per_channel_media jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.social_scheduled_posts.per_channel_media IS 'Per-platform media override: {instagram:[{url,type,order}], tiktok:[...]}';