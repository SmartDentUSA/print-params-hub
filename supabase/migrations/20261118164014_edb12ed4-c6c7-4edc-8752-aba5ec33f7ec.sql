alter table public.promotional_coupons
  add column if not exists li_used_count integer,
  add column if not exists li_usage_checked_at timestamptz;
comment on column public.promotional_coupons.li_used_count is 'Vezes que o cupom foi usado na Loja Integrada (quantidade_usada), lido pela rotina de uso de cupons.';