-- Remove duplicate parameter sets keeping only the most recent one
DELETE FROM parameter_sets 
WHERE id NOT IN (
  SELECT DISTINCT ON (brand_slug, model_slug, resin_name, resin_manufacturer, layer_height) id
  FROM parameter_sets 
  ORDER BY brand_slug, model_slug, resin_name, resin_manufacturer, layer_height, created_at DESC
);

-- Add unique constraint to prevent future duplicates
ALTER TABLE parameter_sets 
ADD CONSTRAINT unique_parameter_combination 
UNIQUE (brand_slug, model_slug, resin_name, resin_manufacturer, layer_height);