CREATE OR REPLACE FUNCTION public.fn_professional_ecom_items(_lead_id uuid)
RETURNS TABLE(nome_produto text, valor_total numeric, data_pedido timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT i.nome_produto::text, i.valor_total::numeric, o.data_pedido::timestamptz
  FROM public.loja_integrada_orders o
  JOIN public.loja_integrada_order_items i ON i.order_id = o.id
  JOIN public.lia_attendances l ON l.id = o.attendance_id
  WHERE public.is_admin(auth.uid())
    AND (l.id = _lead_id OR l.merged_into = _lead_id)
    AND lower(coalesce(o.status,'')) NOT IN ('cancelado','cancelada','cancelled','canceled','estornado')
$$;
REVOKE ALL ON FUNCTION public.fn_professional_ecom_items(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_professional_ecom_items(uuid) TO authenticated, service_role;