
ALTER TABLE public.dealer_price_items ADD COLUMN IF NOT EXISTS color text;

-- Backfill from catalog_product_variations by (catalog_product_id, presentation_qty) or by sku
UPDATE public.dealer_price_items d
SET color = v.color
FROM public.catalog_product_variations v
WHERE d.color IS NULL
  AND v.color IS NOT NULL
  AND (
    (d.sku IS NOT NULL AND d.sku = v.sku)
    OR (
      d.catalog_product_id = v.catalog_product_id
      AND lower(regexp_replace(coalesce(d.presentation_qty,''), '\s+', '', 'g'))
        = lower(regexp_replace(coalesce(v.presentation_qty,''), '\s+', '', 'g'))
    )
  );
