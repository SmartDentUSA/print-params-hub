ALTER TABLE public.promotional_tables
  ADD COLUMN IF NOT EXISTS commercial_active boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.promotional_tables.commercial_active IS
  'Ativa para comercial: entra na sequência de tabelas vigentes da Agenda (vale do início ao fim, troca à meia-noite de São Paulo).';

CREATE INDEX IF NOT EXISTS idx_promotional_tables_commercial_active
  ON public.promotional_tables (valid_from, valid_until)
  WHERE commercial_active AND status = 'active';