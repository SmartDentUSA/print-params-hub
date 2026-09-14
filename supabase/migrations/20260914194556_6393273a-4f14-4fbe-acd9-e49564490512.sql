ALTER TABLE public.promotional_tables
  ADD COLUMN IF NOT EXISTS coupon_li_category_ids bigint[] NOT NULL DEFAULT '{}'::bigint[];

COMMENT ON COLUMN public.promotional_tables.coupon_li_category_ids IS 'IDs de categorias da Loja Integrada onde os cupons desta promoção podem ser aplicados. Vazio = todos os produtos.';