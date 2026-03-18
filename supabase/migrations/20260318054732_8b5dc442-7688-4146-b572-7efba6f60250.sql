ALTER TABLE public.lia_attendances
  ADD COLUMN IF NOT EXISTS lojaintegrada_tipo_pessoa text,
  ADD COLUMN IF NOT EXISTS lojaintegrada_cliente_data_criacao timestamptz;