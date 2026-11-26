CREATE OR REPLACE FUNCTION public.fn_event_store_breakdown(p_event_id uuid DEFAULT NULL)
RETURNS TABLE(event_id uuid, tipo text, rotulo text, pedidos bigint, quantidade numeric, receita numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
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
 ), lines AS (
   SELECT p.eid,p.oid,p.amount,btrim(i->>'nome') nm,COALESCE((i->>'qty')::numeric,1) q,
     COALESCE((i->>'qty')::numeric,1)*COALESCE((i->>'preco')::numeric,0) lv
   FROM paid p CROSS JOIN LATERAL jsonb_array_elements(p.itens) i WHERE COALESCE(btrim(i->>'nome'),'')<>''
 ), lines2 AS (
   SELECT l.*, sum(l.lv) OVER (PARTITION BY l.eid,l.oid) tot FROM lines l
 )
 SELECT p.eid,'cupom'::text,c.code,count(*),count(*)::numeric,COALESCE(sum(p.amount),0)
 FROM paid p JOIN coupons c ON c.eid=p.eid AND c.code=upper(btrim(p.coupon)) GROUP BY p.eid,c.code
 UNION ALL
 SELECT l.eid,'produto'::text,l.nm,count(DISTINCT l.oid),sum(l.q),
   round(sum(CASE WHEN l.tot>0 AND l.amount IS NOT NULL THEN l.amount*l.lv/l.tot ELSE l.lv END),2)
 FROM lines2 l GROUP BY l.eid,l.nm;
END $$;

CREATE OR REPLACE FUNCTION public.fn_event_crm_products(p_event_id uuid DEFAULT NULL)
RETURNS TABLE(event_id uuid, nome text, negocios bigint, quantidade numeric, receita numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF COALESCE(auth.role(),'') <> 'service_role' AND NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Acesso restrito aos administradores' USING ERRCODE='42501'; END IF;
 RETURN QUERY
 WITH sub AS (
   SELECT DISTINCT COALESCE(l0.merged_into,l0.id) lead_id, l0.id raw_id,
     COALESCE((a.event_data->>'event_id')::uuid, ef.event_id, pt.event_id) ev, a.event_timestamp ts
   FROM lead_activity_log a
   JOIN lia_attendances l0 ON l0.id=a.lead_id
   LEFT JOIN smartops_forms ef ON regexp_replace(btrim(ef.name),'^#\s*-\s*','')=regexp_replace(btrim(a.event_data->>'form_name'),'^#\s*-\s*','')
   LEFT JOIN promotional_tables pt ON pt.id=ef.promotional_table_id
   WHERE a.event_type='form_submission'
     AND COALESCE((a.event_data->>'event_id')::uuid, ef.event_id, pt.event_id) IS NOT NULL
     AND (p_event_id IS NULL OR COALESCE((a.event_data->>'event_id')::uuid, ef.event_id, pt.event_id)=p_event_id)
 ),
 wd AS (
   SELECT DISTINCT s.ev, d.piperun_deal_id::text did, COALESCE(d.value,0)::numeric dv
   FROM sub s JOIN deals d ON d.status='ganha' AND COALESCE(d.is_deleted,false)=false
     AND d.lead_id IN (s.lead_id, s.raw_id)
     AND (EXISTS (SELECT 1 FROM smartops_forms sf LEFT JOIN promotional_tables p2 ON p2.id=sf.promotional_table_id
                  WHERE COALESCE(sf.event_id,p2.event_id)=s.ev AND sf.name=d.origin_name)
          OR (d.closed_at IS NOT NULL AND d.closed_at>=s.ts))
 ),
 it AS (
   SELECT wd.ev, wd.dv, i.deal_id, COALESCE(NULLIF(btrim(i.product_name),''),NULLIF(btrim(i.nome_produto),''),'Sem nome') nm,
     COALESCE(i.quantity,i.quantidade,1)::numeric q, COALESCE(i.total_value,i.valor_total,0)::numeric v,
     rank() OVER (PARTITION BY wd.ev, i.deal_id ORDER BY CASE i.source WHEN 'piperun_proposal_json' THEN 1 WHEN 'piperun_proposal' THEN 2 WHEN 'piperun' THEN 3 WHEN 'piperun-csv-import' THEN 4 ELSE 5 END) rk
   FROM wd JOIN deal_items i ON i.deal_id=wd.did AND i.parent_deal_item_id IS NULL
 ),
 it2 AS (SELECT it.*, sum(it.v) OVER (PARTITION BY it.ev, it.deal_id) tot FROM it WHERE rk=1)
 SELECT it2.ev, it2.nm, count(DISTINCT it2.deal_id)::bigint, sum(it2.q),
   round(sum(CASE WHEN it2.tot>0 AND it2.dv>0 THEN it2.dv*it2.v/it2.tot ELSE it2.v END),2)
 FROM it2 GROUP BY it2.ev, it2.nm;
END $$;

CREATE OR REPLACE FUNCTION public.fn_event_previous_funnel(p_event_id uuid DEFAULT NULL)
RETURNS TABLE(event_id uuid, funil text, leads bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF COALESCE(auth.role(),'') <> 'service_role' AND NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Acesso restrito aos administradores' USING ERRCODE='42501'; END IF;
 RETURN QUERY
 WITH sub AS (
   SELECT COALESCE(l0.merged_into,l0.id) lead_id,
     COALESCE((a.event_data->>'event_id')::uuid, ef.event_id, pt.event_id) ev, min(a.event_timestamp) ts
   FROM lead_activity_log a
   JOIN lia_attendances l0 ON l0.id=a.lead_id
   LEFT JOIN smartops_forms ef ON regexp_replace(btrim(ef.name),'^#\s*-\s*','')=regexp_replace(btrim(a.event_data->>'form_name'),'^#\s*-\s*','')
   LEFT JOIN promotional_tables pt ON pt.id=ef.promotional_table_id
   WHERE a.event_type='form_submission'
     AND COALESCE((a.event_data->>'event_id')::uuid, ef.event_id, pt.event_id) IS NOT NULL
     AND (p_event_id IS NULL OR COALESCE((a.event_data->>'event_id')::uuid, ef.event_id, pt.event_id)=p_event_id)
   GROUP BY 1,2
 ),
 evforms AS (
   SELECT DISTINCT COALESCE(sf.event_id,p2.event_id) ev, regexp_replace(btrim(sf.name),'^#\s*-\s*','') nm
   FROM smartops_forms sf LEFT JOIN promotional_tables p2 ON p2.id=sf.promotional_table_id
   WHERE COALESCE(sf.event_id,p2.event_id) IS NOT NULL
 ),
 prev AS (
   SELECT s.ev, (
     SELECT CASE
       WHEN d.pipeline_name ILIKE '%estagnad%' AND d.stage_name ILIKE '%converteram no funil de vendas%' THEN 'Funil de vendas'
       ELSE NULLIF(btrim(d.pipeline_name),'') END
     FROM deals d
     WHERE COALESCE(d.is_deleted,false)=false
       AND d.lead_id IN (SELECT s.lead_id UNION SELECT x.id FROM lia_attendances x WHERE x.merged_into=s.lead_id)
       -- piperun_created_at is stored as São Paulo wall time
       AND COALESCE(d.piperun_created_at + interval '3 hours', d.created_at) < s.ts - interval '10 minutes'
       AND NOT EXISTS (SELECT 1 FROM evforms f WHERE f.ev=s.ev AND f.nm=regexp_replace(btrim(COALESCE(d.origin_name,'')),'^#\s*-\s*',''))
     ORDER BY COALESCE(d.piperun_created_at + interval '3 hours', d.created_at) DESC LIMIT 1) f
   FROM sub s
 )
 SELECT prev.ev, COALESCE(prev.f,'Sem negócio anterior (lead novo no CRM)'), count(*)::bigint FROM prev GROUP BY 1,2;
END $$;
REVOKE ALL ON FUNCTION public.fn_event_previous_funnel(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_event_crm_products(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_event_store_breakdown(uuid) FROM PUBLIC, anon;