CREATE OR REPLACE FUNCTION public.fn_kol_form_views(_slugs text[])
RETURNS TABLE(slug text, views bigint, visitors bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT s.slug, count(v.id), count(DISTINCT coalesce(v.ip_hash, v.session_id))
  FROM unnest(_slugs) s(slug)
  LEFT JOIN public.lead_page_views v
    ON v.page_path = '/f/' || s.slug OR v.page_path LIKE '/f/' || s.slug || '?%' OR v.page_path LIKE '/f/' || s.slug || '/%'
  GROUP BY s.slug
$$;
REVOKE ALL ON FUNCTION public.fn_kol_form_views(text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_kol_form_views(text[]) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.fn_kol_coupon_sales(_code text, _from date DEFAULT NULL, _to date DEFAULT NULL)
RETURNS TABLE(vendas bigint, receita numeric, clientes bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT count(*), coalesce(sum(valor_total),0), count(DISTINCT attendance_id)
  FROM public.loja_integrada_orders o
  WHERE (upper(o.cupom_codigo) = upper(_code) OR upper(o.cupom_json->>'codigo') = upper(_code))
    AND lower(coalesce(o.status,'')) NOT IN ('cancelado','cancelada','canceled','cancelled')
    AND (_from IS NULL OR o.data_pedido >= _from)
    AND (_to IS NULL OR o.data_pedido < _to + 1)
$$;
REVOKE ALL ON FUNCTION public.fn_kol_coupon_sales(text, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_kol_coupon_sales(text, date, date) TO authenticated, service_role;