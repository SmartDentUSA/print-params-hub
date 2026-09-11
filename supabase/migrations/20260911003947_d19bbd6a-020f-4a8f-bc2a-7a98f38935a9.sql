CREATE TABLE public.promotional_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  pdf_title text NOT NULL DEFAULT 'TABELA PROMOCIONAL',
  distributor_id uuid REFERENCES public.distributors(id) ON DELETE SET NULL,
  currency text NOT NULL DEFAULT 'BRL',
  valid_from date,
  valid_until date,
  notes text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','archived')),
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.promotional_tables TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.promotional_tables TO authenticated;
GRANT ALL ON public.promotional_tables TO service_role;
ALTER TABLE public.promotional_tables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users view promotional tables" ON public.promotional_tables FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage promotional tables" ON public.promotional_tables FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) AND created_by = auth.uid());

CREATE TABLE public.promotional_table_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promotional_table_id uuid NOT NULL REFERENCES public.promotional_tables(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.promotional_table_sections TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.promotional_table_sections TO authenticated;
GRANT ALL ON public.promotional_table_sections TO service_role;
ALTER TABLE public.promotional_table_sections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users view promotional sections" ON public.promotional_table_sections FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage promotional sections" ON public.promotional_table_sections FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TABLE public.promotional_table_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id uuid NOT NULL REFERENCES public.promotional_table_sections(id) ON DELETE CASCADE,
  catalog_product_id uuid REFERENCES public.system_a_catalog(id) ON DELETE SET NULL,
  catalog_variation_id uuid REFERENCES public.catalog_product_variations(id) ON DELETE SET NULL,
  item_type text NOT NULL DEFAULT 'catalog' CHECK (item_type IN ('catalog','custom')),
  name text NOT NULL,
  sku text,
  image_url text,
  description text,
  quantity numeric NOT NULL DEFAULT 1 CHECK (quantity > 0),
  market_unit_price numeric NOT NULL DEFAULT 0 CHECK (market_unit_price >= 0),
  promotional_unit_price numeric NOT NULL DEFAULT 0 CHECK (promotional_unit_price >= 0),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.promotional_table_items TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.promotional_table_items TO authenticated;
GRANT ALL ON public.promotional_table_items TO service_role;
ALTER TABLE public.promotional_table_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users view promotional items" ON public.promotional_table_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage promotional items" ON public.promotional_table_items FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX promotional_tables_status_idx ON public.promotional_tables(status, updated_at DESC);
CREATE INDEX promotional_sections_table_idx ON public.promotional_table_sections(promotional_table_id, sort_order);
CREATE INDEX promotional_items_section_idx ON public.promotional_table_items(section_id, sort_order);

CREATE OR REPLACE FUNCTION public.set_promotional_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_promotional_tables_updated_at BEFORE UPDATE ON public.promotional_tables FOR EACH ROW EXECUTE FUNCTION public.set_promotional_updated_at();
CREATE TRIGGER set_promotional_sections_updated_at BEFORE UPDATE ON public.promotional_table_sections FOR EACH ROW EXECUTE FUNCTION public.set_promotional_updated_at();
CREATE TRIGGER set_promotional_items_updated_at BEFORE UPDATE ON public.promotional_table_items FOR EACH ROW EXECUTE FUNCTION public.set_promotional_updated_at();