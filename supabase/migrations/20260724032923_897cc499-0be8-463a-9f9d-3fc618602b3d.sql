UPDATE public.dealer_price_items AS item
SET price_base = CASE UPPER(price_list.currency)
    WHEN 'USD' THEN COALESCE(variation.price_usd, 0)
    WHEN 'EUR' THEN COALESCE(variation.price_eur, 0)
    WHEN 'BRL' THEN COALESCE(variation.price_brl, 0)
    ELSE 0
  END,
  price_dealer = ROUND((CASE UPPER(price_list.currency)
    WHEN 'USD' THEN COALESCE(variation.price_usd, 0)
    WHEN 'EUR' THEN COALESCE(variation.price_eur, 0)
    WHEN 'BRL' THEN COALESCE(variation.price_brl, 0)
    ELSE 0
  END) * (1 - LEAST(100, GREATEST(0, COALESCE(item.discount_pct, 0))) / 100.0), 2),
  updated_at = now()
FROM public.dealer_price_lists AS price_list
JOIN public.catalog_product_variations AS variation
  ON variation.catalog_product_id IS NOT NULL
WHERE item.price_list_id = price_list.id
  AND variation.catalog_product_id = item.catalog_product_id
  AND LOWER(REGEXP_REPLACE(TRIM(COALESCE(variation.presentation_qty, '')), '\s+', '', 'g')) = LOWER(REGEXP_REPLACE(TRIM(COALESCE(item.presentation_qty, '')), '\s+', '', 'g'))
  AND price_list.is_active = true;