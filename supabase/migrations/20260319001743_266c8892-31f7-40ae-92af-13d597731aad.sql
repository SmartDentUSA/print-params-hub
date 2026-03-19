-- Clean ghost order histories: leads where all orders have the same LTV
-- (indicating they got the store's first 100 orders instead of their own)
-- Reset historico_pedidos to NULL so the next sync picks up real data
UPDATE lia_attendances
SET lojaintegrada_historico_pedidos = NULL,
    lojaintegrada_total_pedidos_pagos = NULL
WHERE lojaintegrada_historico_pedidos IS NOT NULL
  AND jsonb_array_length(lojaintegrada_historico_pedidos) >= 50;