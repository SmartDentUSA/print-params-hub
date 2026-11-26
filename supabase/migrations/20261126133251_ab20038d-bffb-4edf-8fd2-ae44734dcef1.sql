CREATE OR REPLACE FUNCTION public.fn_event_store_breakdown(p_event_id uuid DEFAULT NULL)
RETURNS TABLE(event_id uuid, tipo text, rotulo text, pedidos bigint, quantidade numeric, receita numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF COALESCE(auth.role(),'') <> 'service_role' AND NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Acesso restrito aos administradores' USING ERRCODE='42501'; END IF;
 RETURN QUERY
 WITH ev AS (
   SELECT e.id,(e.start_date::timestamp AT TIME ZONE 'America/Sao_Paulo') starts,((e.end_date+1)::timestamp AT TIME ZONE 'America/Sao_Paulo') ends
   FROM smartops_events e WHERE e.event_type='campanha_promocional' AND e.start_date IS NOT NULL AND e.end_date IS NOT NULL AND (p_event_id IS NULL OR e.id=p_event_id)
 ), snapshots AS (
   SELECT COALESCE(a.event_data->>'pedido',a.entity_id) oid,a.event_timestamp order_date,a.created_at updated,
     CASE a.event_type WHEN 'ecommerce_order_paid' THEN 'paid' WHEN 'ecommerce_order_invoiced' THEN 'invoiced' WHEN 'ecommerce_order_delivered' THEN 'delivered' WHEN 'ecommerce_order_cancelled' THEN 'cancelled' ELSE 'pending' END status,
     COALESCE(a.value_numeric,(a.event_data->>'valor')::numeric) amount,a.event_data->'cupom'->>'codigo' coupon,
     CASE WHEN jsonb_typeof(a.event_data->'itens')='array' THEN a.event_data->'itens' END itens
   FROM lead_activity_log a WHERE a.source_channel='ecommerce' AND a.event_type IN ('ecommerce_order_created','ecommerce_order_paid','ecommerce_order_invoiced','ecommerce_order_delivered','ecommerce_order_cancelled')
 ), latest AS (
   SELECT DISTINCT ON(s.oid) s.oid,s.status,s.amount,s.coupon,min(s.order_date) OVER(PARTITION BY s.oid) first_date,
     (SELECT s2.itens FROM snapshots s2 WHERE s2.oid=s.oid AND s2.itens IS NOT NULL ORDER BY s2.updated DESC LIMIT 1) itens
   FROM snapshots s WHERE s.oid IS NOT NULL ORDER BY s.oid,s.updated DESC NULLS LAST
 ), paid AS (
   SELECT ev.id eid,l.* FROM latest l JOIN ev ON l.first_date>=ev.starts AND l.first_date<ev.ends
   WHERE l.status IN ('paid','invoiced','delivered')
 ), coupons AS (
   SELECT DISTINCT pt.event_id eid,upper(btrim(c.code)) code FROM promotional_tables pt JOIN promotional_coupons c ON c.promotional_table_id=pt.id
 )
 SELECT p.eid,'cupom'::text,c.code,count(*),count(*)::numeric,COALESCE(sum(p.amount),0)
 FROM paid p JOIN coupons c ON c.eid=p.eid AND c.code=upper(btrim(p.coupon)) GROUP BY p.eid,c.code
 UNION ALL
 SELECT p.eid,'produto'::text,btrim(i->>'nome'),count(DISTINCT p.oid),sum(COALESCE((i->>'qty')::numeric,1)),
   round(sum(COALESCE((i->>'qty')::numeric,1)*COALESCE((i->>'preco')::numeric,0)),2)
 FROM paid p CROSS JOIN LATERAL jsonb_array_elements(p.itens) i WHERE COALESCE(btrim(i->>'nome'),'')<>'' GROUP BY p.eid,btrim(i->>'nome');
END $$;
REVOKE ALL ON FUNCTION public.fn_event_store_breakdown(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_event_store_breakdown(uuid) TO authenticated,service_role;