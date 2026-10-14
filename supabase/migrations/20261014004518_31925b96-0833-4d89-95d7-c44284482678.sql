CREATE OR REPLACE FUNCTION public.fn_kol_default_commission_rows(_from date DEFAULT current_date)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'kind', case when i.kind = 'produto' then 'product' when i.kind = 'indicacao' then 'referral' else 'category' end,
    'category', i.category, 'subcategory', i.subcategory,
    'product_id', coalesce(i.product_id,''),
    'product_name', case when i.kind = 'indicacao' then 'Comissão por indicação'
                     else coalesce(case when i.kind='produto' then i.product_id end,
                     case when i.subcategory is not null then i.category||' › '||i.subcategory else i.category end) end,
    'percent', i.percent, 'coupon_discount_percent', i.coupon_discount_percent,
    'active_from', _from, 'source', 'padrao') order by i.category, i.subcategory), '[]'::jsonb)
  from kol_commission_template_items i join kol_commission_templates t on t.id = i.template_id and t.is_default
$$;