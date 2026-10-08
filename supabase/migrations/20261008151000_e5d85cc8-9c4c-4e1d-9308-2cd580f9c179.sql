CREATE OR REPLACE FUNCTION public.fn_kol_coupon_items(_code text, _from date DEFAULT NULL, _to date DEFAULT NULL)
RETURNS TABLE(produto text, quantidade numeric, valor numeric, data_pedido date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT coalesce(nullif(i.nome_canonico,''), i.nome_produto), coalesce(i.quantidade,1)::numeric, coalesce(i.valor_total,0)::numeric, o.data_pedido::date
  FROM public.loja_integrada_orders o
  JOIN public.loja_integrada_order_items i ON i.order_id = o.id
  WHERE public.is_admin(auth.uid())
    AND (upper(o.cupom_codigo) = upper(_code) OR upper(o.cupom_json->>'codigo') = upper(_code))
    AND lower(coalesce(o.status,'')) NOT IN ('cancelado','cancelada','canceled','cancelled')
    AND (_from IS NULL OR o.data_pedido >= _from)
    AND (_to IS NULL OR o.data_pedido < _to + 1)
$$;
GRANT EXECUTE ON FUNCTION public.fn_kol_coupon_items(text, date, date) TO authenticated;