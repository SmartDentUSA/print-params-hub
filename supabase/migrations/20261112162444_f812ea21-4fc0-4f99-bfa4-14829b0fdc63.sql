ALTER TABLE public.smartops_forms
  ADD COLUMN IF NOT EXISTS promotional_table_id uuid REFERENCES public.promotional_tables(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_smartops_forms_promotional_table_id ON public.smartops_forms(promotional_table_id) WHERE promotional_table_id IS NOT NULL;