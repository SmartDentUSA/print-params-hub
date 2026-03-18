-- Limpar ~29 leads corrompidos que receberam os 100 primeiros pedidos da loja inteira
UPDATE lia_attendances
SET 
  lojaintegrada_historico_pedidos = '[]'::jsonb,
  lojaintegrada_total_pedidos_pagos = 0,
  ltv_total = NULL,
  lojaintegrada_ultimo_pedido_data = NULL,
  lojaintegrada_ultimo_pedido_valor = NULL,
  lojaintegrada_ultimo_pedido_numero = NULL,
  lojaintegrada_ultimo_pedido_status = NULL
WHERE jsonb_array_length(COALESCE(lojaintegrada_historico_pedidos, '[]'::jsonb)) = 100
  AND lojaintegrada_historico_pedidos IS NOT NULL;