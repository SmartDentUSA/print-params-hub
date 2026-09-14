ALTER TABLE public.promotional_tables
  ADD COLUMN IF NOT EXISTS coupon_seller_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS coupon_discount_type text NOT NULL DEFAULT 'percent',
  ADD COLUMN IF NOT EXISTS coupon_discount_value numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS coupon_prefix text,
  ADD COLUMN IF NOT EXISTS coupon_usage_limit integer,
  ADD COLUMN IF NOT EXISTS coupon_valid_from date,
  ADD COLUMN IF NOT EXISTS coupon_valid_until date;

CREATE TABLE IF NOT EXISTS public.promotional_coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promotional_table_id uuid NOT NULL REFERENCES public.promotional_tables(id) ON DELETE CASCADE,
  team_member_id uuid REFERENCES public.team_members(id) ON DELETE SET NULL,
  seller_name text,
  code text NOT NULL,
  discount_type text NOT NULL DEFAULT 'percent',
  discount_value numeric NOT NULL DEFAULT 0,
  valid_from date,
  valid_until date,
  usage_limit integer,
  active boolean NOT NULL DEFAULT true,
  li_coupon_id text,
  li_synced_at timestamptz,
  li_sync_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (promotional_table_id, code)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.promotional_coupons TO authenticated;
GRANT ALL ON public.promotional_coupons TO service_role;

ALTER TABLE public.promotional_coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Equipe gerencia cupons promocionais"
ON public.promotional_coupons FOR ALL
TO authenticated
USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_promotional_coupons_table ON public.promotional_coupons(promotional_table_id);

CREATE TRIGGER trg_promotional_coupons_updated_at
BEFORE UPDATE ON public.promotional_coupons
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();