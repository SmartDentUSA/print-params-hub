-- Clean up product_history entries with wrong 2026 sync dates (will be rebuilt by re-sync)
DELETE FROM lead_product_history 
WHERE first_viewed_at >= '2026-03-14'
  AND first_viewed_at <= '2026-03-20';

-- Clean up timeline entries with wrong sync dates (will be rebuilt by re-sync with correct orderDate)
DELETE FROM lead_activity_log
WHERE event_type LIKE 'ecommerce_order_%'
  AND event_timestamp >= '2026-03-17'
  AND event_timestamp <= '2026-03-20'
  AND source_channel = 'ecommerce';

-- Fix cart_history: set converted_at to actual order date instead of sync date
UPDATE lead_cart_history 
SET converted_at = created_at 
WHERE converted_at >= '2026-03-14' 
  AND created_at < '2026-03-14';

-- Delete cart_history entries created during sync with wrong dates
DELETE FROM lead_cart_history
WHERE created_at >= '2026-03-14'
  AND created_at <= '2026-03-20'
  AND status IN ('active', 'converted');