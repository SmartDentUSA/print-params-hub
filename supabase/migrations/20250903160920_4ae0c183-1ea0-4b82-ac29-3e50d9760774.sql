-- Insert sample models for Anycubic brand to enable image display
-- First, get the Anycubic brand ID
INSERT INTO brands (name, slug, active) VALUES ('Anycubic', 'anycubic', true) 
ON CONFLICT (slug) DO UPDATE SET name = 'Anycubic', active = true;

-- Insert models for common Anycubic printers found in parameter_sets
WITH anycubic_brand AS (
  SELECT id FROM brands WHERE slug = 'anycubic'
)
INSERT INTO models (name, slug, brand_id, active, notes) 
SELECT 
  model_name,
  model_slug,
  (SELECT id FROM anycubic_brand),
  true,
  'Impressora 3D de resina'
FROM (VALUES 
  ('Mono X', 'mono-x'),
  ('Photon D2 DLP', 'photon-d2-dlp'),
  ('Photon M2', 'photon-m2'),
  ('Photon M5', 'photon-m5'),
  ('Photon M5s', 'photon-m5s'),
  ('Photon Mono 2', 'photon-mono-2'),
  ('Photon Mono 4', 'photon-mono-4'),
  ('Photon Mono 4 Ultra 10K', 'photon-mono-4-ultra-10k'),
  ('Photon Mono 4K', 'photon-mono-4k'),
  ('Photon Mono M7', 'photon-mono-m7')
) AS model_data(model_name, model_slug)
ON CONFLICT (slug) DO UPDATE SET 
  name = EXCLUDED.name,
  notes = EXCLUDED.notes,
  active = EXCLUDED.active;