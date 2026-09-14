ALTER TABLE public.promotional_tables
  ADD COLUMN IF NOT EXISTS coupon_pdf_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS coupon_freight_pdf_enabled boolean NOT NULL DEFAULT true;