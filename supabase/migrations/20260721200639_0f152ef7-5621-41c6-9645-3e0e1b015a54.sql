ALTER TABLE public.catalog_product_variations
  DROP CONSTRAINT IF EXISTS catalog_product_variations_catalog_product_id_presentation__key;

ALTER TABLE public.catalog_product_variations
  ADD CONSTRAINT catalog_product_variations_product_qty_color_sku_key
  UNIQUE (catalog_product_id, presentation_qty, color, sku);