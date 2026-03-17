-- Clean fake e-commerce data (identical 20 orders from April 2020 replicated across 1144 leads)
UPDATE lia_attendances
SET lojaintegrada_historico_pedidos = NULL,
    lojaintegrada_total_pedidos_pagos = NULL,
    lojaintegrada_ltv = NULL
WHERE lojaintegrada_historico_pedidos IS NOT NULL
  AND jsonb_array_length(lojaintegrada_historico_pedidos) = 20
  AND (lojaintegrada_historico_pedidos->0->>'numero')::text = '1'
  AND (lojaintegrada_historico_pedidos->0->>'valor')::text = '717.7';