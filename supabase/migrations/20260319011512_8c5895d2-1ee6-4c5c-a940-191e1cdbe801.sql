
-- Backfill: Fix ghost lojaintegrada_ltv for leads with no historico_pedidos
-- Replace phantom 57433.20 (and other ghost values) with real LTV from activity log events
-- This is a one-time data cleanup

UPDATE lia_attendances la
SET 
  lojaintegrada_ltv = COALESCE((
    SELECT SUM(value_numeric) 
    FROM lead_activity_log 
    WHERE lead_id = la.id 
      AND source_channel = 'ecommerce' 
      AND event_type LIKE '%invoiced%'
  ), 0),
  lojaintegrada_historico_pedidos = NULL,
  lojaintegrada_total_pedidos_pagos = COALESCE((
    SELECT COUNT(DISTINCT (event_data->>'pedido')::text) 
    FROM lead_activity_log 
    WHERE lead_id = la.id 
      AND source_channel = 'ecommerce' 
      AND event_type LIKE '%invoiced%'
  ), 0)
WHERE la.merged_into IS NULL
  AND la.lojaintegrada_ltv IS NOT NULL 
  AND la.lojaintegrada_ltv > 0
  AND (la.lojaintegrada_historico_pedidos IS NULL OR la.lojaintegrada_historico_pedidos::text IN ('null', '[]'));
