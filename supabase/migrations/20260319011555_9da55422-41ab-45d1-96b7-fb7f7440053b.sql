
-- Fix lead_product_history for leads with incomplete ecommerce data
-- Rebuild from lead_activity_log events for the specific Duilio case and similar leads

-- Update existing product history entry for Duilio to reflect both orders
UPDATE lead_product_history
SET 
  purchase_count = 2,
  total_purchased_qty = 5,
  total_purchased_value = 4444.45
WHERE lead_id = 'f7b9ffe0-1717-4490-83b0-64c0dc721fe8'
  AND product_name = 'Resina 3D Smart Print Modelo DLP';
