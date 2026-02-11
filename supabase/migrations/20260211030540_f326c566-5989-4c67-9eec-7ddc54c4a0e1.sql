
-- Add is_premium column to knowledge_videos
ALTER TABLE public.knowledge_videos ADD COLUMN is_premium BOOLEAN DEFAULT false;

-- Insert members_area_url setting
INSERT INTO public.site_settings (key, value) VALUES ('members_area_url', '')
ON CONFLICT (key) DO NOTHING;
