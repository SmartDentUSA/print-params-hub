
-- Purge legacy e-commerce entries (without situacao_aprovado field) from lojaintegrada_historico_pedidos
-- and reset derived fields to force recalculation on next sync
UPDATE lia_attendances
SET 
  lojaintegrada_historico_pedidos = (
    SELECT jsonb_agg(elem)
    FROM jsonb_array_elements(lojaintegrada_historico_pedidos) elem
    WHERE elem ? 'situacao_aprovado'
  ),
  lojaintegrada_ltv = NULL,
  lojaintegrada_total_pedidos_pagos = NULL,
  lojaintegrada_ultimo_pedido_data = NULL,
  lojaintegrada_ultimo_pedido_valor = NULL,
  lojaintegrada_ultimo_pedido_status = NULL,
  lojaintegrada_updated_at = now()
WHERE lojaintegrada_historico_pedidos IS NOT NULL
  AND jsonb_typeof(lojaintegrada_historico_pedidos) = 'array'
  AND jsonb_array_length(lojaintegrada_historico_pedidos) > 0
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(lojaintegrada_historico_pedidos) elem
    WHERE NOT (elem ? 'situacao_aprovado')
  );
