ALTER TABLE public.lia_attendances 
  ADD COLUMN IF NOT EXISTS informacao_desejada text,
  ADD COLUMN IF NOT EXISTS codigo_contrato text,
  ADD COLUMN IF NOT EXISTS data_treinamento text,
  ADD COLUMN IF NOT EXISTS produto_interesse_auto text;