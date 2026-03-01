
-- Add Loja Integrada specific columns to lia_attendances
ALTER TABLE public.lia_attendances
  ADD COLUMN IF NOT EXISTS lojaintegrada_cliente_id integer,
  ADD COLUMN IF NOT EXISTS lojaintegrada_cliente_obs text,
  ADD COLUMN IF NOT EXISTS lojaintegrada_cupom_desconto text,
  ADD COLUMN IF NOT EXISTS lojaintegrada_data_nascimento date,
  ADD COLUMN IF NOT EXISTS lojaintegrada_sexo text,
  ADD COLUMN IF NOT EXISTS lojaintegrada_endereco text,
  ADD COLUMN IF NOT EXISTS lojaintegrada_numero text,
  ADD COLUMN IF NOT EXISTS lojaintegrada_complemento text,
  ADD COLUMN IF NOT EXISTS lojaintegrada_bairro text,
  ADD COLUMN IF NOT EXISTS lojaintegrada_cep text,
  ADD COLUMN IF NOT EXISTS lojaintegrada_referencia text,
  ADD COLUMN IF NOT EXISTS lojaintegrada_ultimo_pedido_numero integer,
  ADD COLUMN IF NOT EXISTS lojaintegrada_ultimo_pedido_data timestamptz,
  ADD COLUMN IF NOT EXISTS lojaintegrada_ultimo_pedido_valor numeric,
  ADD COLUMN IF NOT EXISTS lojaintegrada_ultimo_pedido_status text,
  ADD COLUMN IF NOT EXISTS lojaintegrada_forma_pagamento text,
  ADD COLUMN IF NOT EXISTS lojaintegrada_forma_envio text,
  ADD COLUMN IF NOT EXISTS lojaintegrada_itens_json jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS lojaintegrada_utm_campaign text,
  ADD COLUMN IF NOT EXISTS lojaintegrada_updated_at timestamptz;

-- Index for filtering by LI client ID
CREATE INDEX IF NOT EXISTS idx_lia_lojaintegrada_cliente_id ON public.lia_attendances (lojaintegrada_cliente_id) WHERE lojaintegrada_cliente_id IS NOT NULL;
