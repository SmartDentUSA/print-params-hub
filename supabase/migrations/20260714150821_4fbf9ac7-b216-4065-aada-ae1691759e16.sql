
-- 1) Distribuidor: moeda preferida (idioma já existe)
ALTER TABLE public.distributors
  ADD COLUMN IF NOT EXISTS preferred_currency text NOT NULL DEFAULT 'BRL';

-- 2) Itens da tabela de preço: apresentação (Grs/Kg | Unit | Kit) e multiplicador
ALTER TABLE public.dealer_price_items
  ADD COLUMN IF NOT EXISTS presentation text NOT NULL DEFAULT 'Unit',
  ADD COLUMN IF NOT EXISTS quantity_multiplier numeric NOT NULL DEFAULT 1;

-- Constraint em presentation
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dealer_price_items_presentation_chk') THEN
    ALTER TABLE public.dealer_price_items
      ADD CONSTRAINT dealer_price_items_presentation_chk
      CHECK (presentation IN ('Grs/Kg','Unit','Kit'));
  END IF;
END $$;

-- 3) Histórico de tabelas salvas (snapshot) por distribuidor
CREATE TABLE IF NOT EXISTS public.dealer_price_list_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  distributor_id uuid NOT NULL REFERENCES public.distributors(id) ON DELETE CASCADE,
  price_list_id uuid REFERENCES public.dealer_price_lists(id) ON DELETE SET NULL,
  label text,
  currency text NOT NULL DEFAULT 'BRL',
  language text NOT NULL DEFAULT 'pt',
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  totals jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dealer_price_list_snapshots TO authenticated;
GRANT ALL ON public.dealer_price_list_snapshots TO service_role;

ALTER TABLE public.dealer_price_list_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated manage dealer snapshots"
  ON public.dealer_price_list_snapshots
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_dealer_snapshots_dist ON public.dealer_price_list_snapshots(distributor_id, created_at DESC);
