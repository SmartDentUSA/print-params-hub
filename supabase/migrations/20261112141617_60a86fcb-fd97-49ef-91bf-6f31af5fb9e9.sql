ALTER TABLE public.promotional_tables
  ADD COLUMN IF NOT EXISTS price_table_mode text NOT NULL DEFAULT 'distribution',
  ADD COLUMN IF NOT EXISTS price_table_distributor_id uuid REFERENCES public.distributors(id) ON DELETE SET NULL;

ALTER TABLE public.promotional_tables
  DROP CONSTRAINT IF EXISTS promotional_tables_price_table_mode_chk;
ALTER TABLE public.promotional_tables
  ADD CONSTRAINT promotional_tables_price_table_mode_chk CHECK (price_table_mode IN ('distribution', 'exclusive'));

ALTER TABLE public.dealer_price_lists
  ADD COLUMN IF NOT EXISTS promotional_table_id uuid REFERENCES public.promotional_tables(id) ON DELETE CASCADE;

ALTER TABLE public.dealer_price_lists ALTER COLUMN distributor_id DROP NOT NULL;

ALTER TABLE public.dealer_price_lists
  DROP CONSTRAINT IF EXISTS dealer_price_lists_owner_chk;
ALTER TABLE public.dealer_price_lists
  ADD CONSTRAINT dealer_price_lists_owner_chk CHECK (distributor_id IS NOT NULL OR promotional_table_id IS NOT NULL);

CREATE UNIQUE INDEX IF NOT EXISTS dealer_price_lists_promotional_table_uidx
  ON public.dealer_price_lists (promotional_table_id) WHERE promotional_table_id IS NOT NULL;

ALTER TABLE public.dealer_price_list_snapshots ALTER COLUMN distributor_id DROP NOT NULL;