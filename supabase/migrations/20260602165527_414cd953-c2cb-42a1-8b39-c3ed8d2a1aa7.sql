-- Add product reference + category to social posts, and an AI-friendly view.
ALTER TABLE public.social_scheduled_posts
  ADD COLUMN IF NOT EXISTS product_ref text,
  ADD COLUMN IF NOT EXISTS product_category text;

CREATE INDEX IF NOT EXISTS idx_social_scheduled_posts_product_ref
  ON public.social_scheduled_posts (product_ref);

CREATE INDEX IF NOT EXISTS idx_social_scheduled_posts_product_slug
  ON public.social_scheduled_posts (product_slug);

-- View consolidando posts para consumo por LIA e Copilot
CREATE OR REPLACE VIEW public.v_social_posts_for_ai AS
SELECT
  sp.id,
  sp.scheduled_at,
  sp.published_at,
  sp.status,
  sp.product_ref,
  sp.product_name,
  sp.product_slug,
  sp.product_category,
  sp.caption,
  sp.hashtags,
  sp.first_comment,
  sp.channels,
  sp.media_items,
  sp.post_type,
  sp.created_at
FROM public.social_scheduled_posts sp
WHERE sp.status IN ('scheduled','publishing','published');

GRANT SELECT ON public.v_social_posts_for_ai TO authenticated, service_role;