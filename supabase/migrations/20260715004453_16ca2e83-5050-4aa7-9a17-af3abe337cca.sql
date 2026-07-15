ALTER TABLE public.catalog_product_variations
  ADD COLUMN IF NOT EXISTS weight_kg NUMERIC,
  ADD COLUMN IF NOT EXISTS dimensions_cm TEXT;