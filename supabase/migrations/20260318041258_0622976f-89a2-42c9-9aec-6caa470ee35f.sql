ALTER TABLE lia_attendances
  ADD COLUMN IF NOT EXISTS lojaintegrada_valor_desconto numeric,
  ADD COLUMN IF NOT EXISTS lojaintegrada_valor_envio numeric,
  ADD COLUMN IF NOT EXISTS lojaintegrada_valor_subtotal numeric,
  ADD COLUMN IF NOT EXISTS lojaintegrada_peso_real numeric,
  ADD COLUMN IF NOT EXISTS lojaintegrada_data_modificacao text,
  ADD COLUMN IF NOT EXISTS lojaintegrada_tracking_code text,
  ADD COLUMN IF NOT EXISTS lojaintegrada_parcelas integer,
  ADD COLUMN IF NOT EXISTS lojaintegrada_bandeira_cartao text,
  ADD COLUMN IF NOT EXISTS lojaintegrada_marketplace jsonb,
  ADD COLUMN IF NOT EXISTS lojaintegrada_cupom_json jsonb,
  ADD COLUMN IF NOT EXISTS lojaintegrada_pedido_id bigint,
  ADD COLUMN IF NOT EXISTS lojaintegrada_raw_payload jsonb;