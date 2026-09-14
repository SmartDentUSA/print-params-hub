ALTER TABLE public.promotional_tables
  ADD COLUMN IF NOT EXISTS coupon_li_category_labels text[] NOT NULL DEFAULT '{}'::text[];

COMMENT ON COLUMN public.promotional_tables.coupon_li_category_labels IS 'Nomes das categorias da loja liberadas para os cupons (usado no PDF).';