ALTER TABLE public.lia_attendances
  ADD COLUMN IF NOT EXISTS lojaintegrada_ltv numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS lojaintegrada_total_pedidos_pagos integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS lojaintegrada_primeira_compra timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS lojaintegrada_historico_pedidos jsonb DEFAULT '[]'::jsonb;