CREATE TABLE public.catalog_product_variations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  catalog_product_id uuid NOT NULL REFERENCES public.system_a_catalog(id) ON DELETE CASCADE,
  presentation_qty text NOT NULL,
  gtin_ean text,
  ncm_hs text,
  unidade text NOT NULL DEFAULT 'UN',
  price_brl numeric,
  price_usd numeric,
  price_eur numeric,
  sort_order integer NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'manual',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (catalog_product_id, presentation_qty)
);

CREATE INDEX idx_catalog_product_variations_product
  ON public.catalog_product_variations (catalog_product_id, sort_order);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalog_product_variations TO authenticated;
GRANT ALL ON public.catalog_product_variations TO service_role;

ALTER TABLE public.catalog_product_variations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read catalog variations"
  ON public.catalog_product_variations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated can insert catalog variations"
  ON public.catalog_product_variations FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated can update catalog variations"
  ON public.catalog_product_variations FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated can delete catalog variations"
  ON public.catalog_product_variations FOR DELETE
  TO authenticated
  USING (true);

CREATE OR REPLACE FUNCTION public.tg_catalog_product_variations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER catalog_product_variations_set_updated_at
  BEFORE UPDATE ON public.catalog_product_variations
  FOR EACH ROW EXECUTE FUNCTION public.tg_catalog_product_variations_updated_at();