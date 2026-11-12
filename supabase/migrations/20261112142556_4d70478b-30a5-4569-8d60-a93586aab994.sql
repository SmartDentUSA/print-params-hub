ALTER TABLE public.promotional_tables
  ADD COLUMN IF NOT EXISTS price_table_source_promotion_id uuid REFERENCES public.promotional_tables(id) ON DELETE SET NULL;

ALTER TABLE public.promotional_tables
  DROP CONSTRAINT IF EXISTS promotional_tables_price_table_mode_chk;
ALTER TABLE public.promotional_tables
  ADD CONSTRAINT promotional_tables_price_table_mode_chk CHECK (price_table_mode IN ('distribution', 'exclusive', 'clone'));