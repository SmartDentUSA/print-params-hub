DELETE FROM dealer_price_items a
USING dealer_price_items b
WHERE a.price_list_id=b.price_list_id
  AND a.sku=b.sku
  AND a.sku IS NOT NULL
  AND a.ctid<b.ctid;