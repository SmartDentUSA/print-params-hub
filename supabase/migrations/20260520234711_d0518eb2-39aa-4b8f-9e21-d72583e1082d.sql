ALTER TABLE public.smartops_forms
  ADD COLUMN IF NOT EXISTS tracking_gtm_id          text DEFAULT 'GTM-NZ64Q899',
  ADD COLUMN IF NOT EXISTS tracking_ga4_id          text DEFAULT 'G-1411Z6YVPY',
  ADD COLUMN IF NOT EXISTS tracking_meta_pixel_id   text DEFAULT '167413567155597',
  ADD COLUMN IF NOT EXISTS tracking_tiktok_pixel_id text DEFAULT 'D05CI83C77UE5QUU9FR0',
  ADD COLUMN IF NOT EXISTS tracking_extra_head      text;

UPDATE public.smartops_forms
   SET tracking_gtm_id          = COALESCE(tracking_gtm_id, 'GTM-NZ64Q899'),
       tracking_ga4_id          = COALESCE(tracking_ga4_id, 'G-1411Z6YVPY'),
       tracking_meta_pixel_id   = COALESCE(tracking_meta_pixel_id, '167413567155597'),
       tracking_tiktok_pixel_id = COALESCE(tracking_tiktok_pixel_id, 'D05CI83C77UE5QUU9FR0');