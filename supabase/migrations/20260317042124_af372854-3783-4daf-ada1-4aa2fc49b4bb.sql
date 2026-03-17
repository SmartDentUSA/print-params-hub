UPDATE system_a_catalog 
SET extra_data = jsonb_set(
  COALESCE(extra_data, '{}'::jsonb),
  '{tracking_pixels}',
  '{
    "google_tag_manager": {"enabled": true, "container_id": "GTM-NZ64Q899", "note": "GTM principal - server-side tagging"},
    "google_analytics": {"enabled": false, "measurement_id": "G-59WWJQN34P", "note": "Gerenciado via GTM"},
    "meta_pixel": {"enabled": false, "pixel_id": "167413567155597", "note": "Fallback - controlado por enable_fallback_pixels"},
    "tiktok_pixel": {"enabled": false, "pixel_id": "D05CI83C77UE5QUU9FR0", "note": "Fallback - controlado por enable_fallback_pixels"},
    "enable_fallback_pixels": false
  }'::jsonb
)
WHERE id = 'bf6d26b7-0e7f-450c-9d71-533472a25139';