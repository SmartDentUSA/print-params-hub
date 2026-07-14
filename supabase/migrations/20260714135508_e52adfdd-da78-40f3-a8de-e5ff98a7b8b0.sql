
-- Reusable role checker
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  );
$$;

-- Dealer price lists
CREATE TABLE public.dealer_price_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  distributor_id uuid NOT NULL REFERENCES public.distributors(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Tabela padrão',
  currency text NOT NULL DEFAULT 'BRL',
  language text NOT NULL DEFAULT 'pt',
  exchange_rate numeric(14,4),
  version int NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dealer_price_lists TO authenticated;
GRANT ALL ON public.dealer_price_lists TO service_role;
ALTER TABLE public.dealer_price_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage dealer price lists"
  ON public.dealer_price_lists FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Distribuidores read dealer price lists"
  ON public.dealer_price_lists FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'distribuidor'::public.app_role));

-- Dealer price items
CREATE TABLE public.dealer_price_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  price_list_id uuid NOT NULL REFERENCES public.dealer_price_lists(id) ON DELETE CASCADE,
  catalog_product_id uuid,
  cod text,
  name text NOT NULL,
  name_en text,
  name_es text,
  image_url text,
  category text,
  subcategory text,
  variant text,
  ncm_hs text,
  gtin_ean text,
  unidade text NOT NULL DEFAULT 'UN',
  description text,
  price_base numeric(14,2) NOT NULL DEFAULT 0,
  discount_pct numeric(6,3) NOT NULL DEFAULT 0,
  price_dealer numeric(14,2) NOT NULL DEFAULT 0,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dealer_price_items TO authenticated;
GRANT ALL ON public.dealer_price_items TO service_role;
ALTER TABLE public.dealer_price_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage dealer price items"
  ON public.dealer_price_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Distribuidores read dealer price items"
  ON public.dealer_price_items FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'distribuidor'::public.app_role));

CREATE INDEX idx_dealer_price_items_list ON public.dealer_price_items(price_list_id, sort_order);

-- Dealer proposals
CREATE TABLE public.dealer_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  distributor_id uuid NOT NULL REFERENCES public.distributors(id) ON DELETE CASCADE,
  price_list_id uuid REFERENCES public.dealer_price_lists(id) ON DELETE SET NULL,
  proposal_number text UNIQUE,
  language text NOT NULL DEFAULT 'pt',
  currency text NOT NULL DEFAULT 'BRL',
  header_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  totals jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft',
  pdf_url text,
  public_slug text UNIQUE,
  sent_at timestamptz,
  expires_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dealer_proposals TO authenticated;
GRANT ALL ON public.dealer_proposals TO service_role;
ALTER TABLE public.dealer_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage dealer proposals"
  ON public.dealer_proposals FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Distribuidores read dealer proposals"
  ON public.dealer_proposals FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'distribuidor'::public.app_role));

-- updated_at triggers
CREATE OR REPLACE FUNCTION public.tg_dealer_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_dealer_price_lists_touch BEFORE UPDATE ON public.dealer_price_lists
  FOR EACH ROW EXECUTE FUNCTION public.tg_dealer_touch_updated_at();
CREATE TRIGGER trg_dealer_price_items_touch BEFORE UPDATE ON public.dealer_price_items
  FOR EACH ROW EXECUTE FUNCTION public.tg_dealer_touch_updated_at();
CREATE TRIGGER trg_dealer_proposals_touch BEFORE UPDATE ON public.dealer_proposals
  FOR EACH ROW EXECUTE FUNCTION public.tg_dealer_touch_updated_at();
