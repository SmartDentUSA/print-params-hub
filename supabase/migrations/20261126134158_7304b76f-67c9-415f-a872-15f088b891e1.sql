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
   SELECT DISTINCT s.ev, d.piperun_deal_id::text did
   FROM sub s JOIN deals d ON d.status='ganha' AND COALESCE(d.is_deleted,false)=false
     AND d.lead_id IN (s.lead_id, s.raw_id)
     AND (EXISTS (SELECT 1 FROM smartops_forms sf LEFT JOIN promotional_tables p2 ON p2.id=sf.promotional_table_id
                  WHERE COALESCE(sf.event_id,p2.event_id)=s.ev AND sf.name=d.origin_name)
          OR (d.closed_at IS NOT NULL AND d.closed_at>=s.ts))
 ),
 it AS (
   SELECT wd.ev, i.deal_id, COALESCE(NULLIF(btrim(i.product_name),''),NULLIF(btrim(i.nome_produto),''),'Sem nome') nm,
     COALESCE(i.quantity,i.quantidade,1)::numeric q, COALESCE(i.total_value,i.valor_total,0)::numeric v,
     rank() OVER (PARTITION BY wd.ev, i.deal_id ORDER BY CASE i.source WHEN 'piperun_proposal_json' THEN 1 WHEN 'piperun_proposal' THEN 2 WHEN 'piperun' THEN 3 WHEN 'piperun-csv-import' THEN 4 ELSE 5 END) rk
   FROM wd JOIN deal_items i ON i.deal_id=wd.did AND i.parent_deal_item_id IS NULL
 )
 SELECT it.ev, it.nm, count(DISTINCT it.deal_id)::bigint, sum(it.q), sum(it.v)
 FROM it WHERE rk=1 GROUP BY it.ev, it.nm;
END $$;
REVOKE ALL ON FUNCTION public.fn_event_crm_products(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_event_crm_products(uuid) TO authenticated, service_role;