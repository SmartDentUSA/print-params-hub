-- Add google_place_id to Smart Dent company record
UPDATE system_a_catalog
SET extra_data = jsonb_set(
  COALESCE(extra_data, '{}'::jsonb),
  '{google_place_id}',
  '"ChIJMyaY_dV2uJQRqFsI2PkfL8g"'
)
WHERE id = '243b5464-59ec-48e0-8be8-8d3e170acf56';