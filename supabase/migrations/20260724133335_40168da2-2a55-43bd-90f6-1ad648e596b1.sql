CREATE UNIQUE INDEX IF NOT EXISTS dealer_price_items_list_sku_uidx
ON dealer_price_items(price_list_id, sku) WHERE sku IS NOT NULL;