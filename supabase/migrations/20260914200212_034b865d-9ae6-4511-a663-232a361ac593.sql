ALTER TABLE public.promotional_coupons
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'discount',
  ADD COLUMN IF NOT EXISTS free_shipping boolean NOT NULL DEFAULT false;

ALTER TABLE public.promotional_tables
  ADD COLUMN IF NOT EXISTS coupon_freight_discount_value numeric,
  ADD COLUMN IF NOT EXISTS coupon_freight_valid_from date,
  ADD COLUMN IF NOT EXISTS coupon_freight_valid_until date,
  ADD COLUMN IF NOT EXISTS coupon_freight_usage_limit integer;