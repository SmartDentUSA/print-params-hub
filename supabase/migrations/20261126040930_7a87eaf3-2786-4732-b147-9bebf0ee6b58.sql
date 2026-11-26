UPDATE public.smartops_forms SET promotional_table_id='cefead94-c1ad-4e6d-8f78-ffe4d15cb427', updated_at=now() WHERE id='1f6f96c3-5b75-4ecc-a244-18ef9d2e4964' AND promotional_table_id IS NULL;

CREATE OR REPLACE FUNCTION public.fn_event_campaign_metrics(p_event_id uuid DEFAULT NULL)
RETURNS TABLE(event_id uuid, canal text, campanhas integer, envios bigint, abertos bigint, cliques bigint, leads bigint, entregues bigint, custo numeric, convertidos bigint, valor_convertido numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF COALESCE(auth.role(),'') <> 'service_role' AND NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Acesso restrito aos administradores' USING ERRCODE='42501'; END IF;
 RETURN QUERY
 WITH forms AS (
   SELECT f.id, regexp_replace(btrim(f.name),'^#\s*-\s*','') name, COALESCE(f.event_id,pt.event_id) eid
   FROM smartops_forms f LEFT JOIN promotional_tables pt ON pt.id=f.promotional_table_id
   WHERE COALESCE(f.event_id,pt.event_id) IS NOT NULL
 ), cp AS (
   SELECT DISTINCT c.id,c.canal channel,f.eid,f.id fid,c.metadata
   FROM campaigns c LEFT JOIN smartops_form_landing_pages lp ON lp.id::text=c.cta_config->'cta_principal'->>'id'
   JOIN forms f ON f.id=lp.form_id OR (c.canal='whatsapp_oficial' AND (f.name='[WHTASATIVO] - '||c.nome OR EXISTS(SELECT 1 FROM wa_campaign_lead_jobs j WHERE j.campaign_id=c.id AND j.form_id=f.id)))
   WHERE c.canal IN ('email','whatsapp_oficial','sms') AND (p_event_id IS NULL OR f.eid=p_event_id)
 ), logs AS (
   SELECT cp.eid,cp.channel,cp.id cid,cp.metadata,l.*
   FROM cp JOIN campaign_send_log l ON COALESCE(l.source_campaign_id,l.campaign_id)=cp.id
 ), activity AS (
   SELECT f.id fid, l.id lid, a.event_timestamp submitted_at
   FROM lead_activity_log a JOIN forms f ON f.name=regexp_replace(btrim(a.event_data->>'form_name'),'^#\s*-\s*','')
   JOIN lia_attendances l ON l.id=a.lead_id AND l.merged_into IS NULL
   WHERE a.event_type='form_submission'
   UNION
   SELECT f.id,s.lead_id,s.submitted_at FROM lead_form_submissions s JOIN forms f ON f.id::text=s.form_id JOIN lia_attendances l ON l.id=s.lead_id AND l.merged_into IS NULL
 ), generated AS (
   SELECT cp.eid,cp.channel,a.lid,min(a.submitted_at) submitted_at
   FROM cp JOIN activity a ON a.fid=cp.fid
   WHERE cp.channel='whatsapp_oficial' OR EXISTS(SELECT 1 FROM logs x WHERE x.cid=cp.id AND x.lead_id=a.lid AND x.sent_at IS NOT NULL AND a.submitted_at>=x.sent_at)
   GROUP BY cp.eid,cp.channel,a.lid
 ), wins AS (
   SELECT DISTINCT g.eid,g.channel,d.id,g.lid,d.value
   FROM generated g JOIN deals d ON d.lead_id=g.lid AND d.status='ganha' AND NOT COALESCE(d.is_deleted,false)
   WHERE COALESCE(d.closed_at,d.piperun_updated_at)>=g.submitted_at
 ), totals AS (
   SELECT x.eid,x.channel,count(*) FILTER(WHERE x.sent_at IS NOT NULL OR x.status IN ('sent','delivered','read','opened','clicked')) sent,
     count(*) FILTER(WHERE x.opened_at IS NOT NULL) opened,count(*) FILTER(WHERE x.clicked_at IS NOT NULL) clicked,
     count(*) FILTER(WHERE x.delivered_at IS NOT NULL OR x.opened_at IS NOT NULL OR x.status IN ('delivered','read')) delivered,
     CASE WHEN count(*) FILTER(WHERE x.metadata->>'cost_per_message' ~ '^[0-9]+(\.[0-9]+)?$')=count(*) THEN
       round(sum(CASE WHEN x.channel='whatsapp_oficial' THEN CASE WHEN x.delivered_at IS NOT NULL OR x.opened_at IS NOT NULL OR x.status IN ('delivered','read') THEN (x.metadata->>'cost_per_message')::numeric ELSE 0 END
       ELSE CASE WHEN x.sent_at IS NOT NULL THEN (x.metadata->>'cost_per_message')::numeric ELSE 0 END END),2) END cost
   FROM logs x GROUP BY x.eid,x.channel
 )
 SELECT cp.eid,cp.channel,count(DISTINCT cp.id)::integer,COALESCE(t.sent,0),COALESCE(t.opened,0),
   CASE WHEN cp.channel='whatsapp_oficial' THEN (SELECT count(DISTINCT j.phone) FROM wa_campaign_lead_jobs j JOIN cp c2 ON c2.id=j.campaign_id WHERE c2.eid=cp.eid AND c2.channel=cp.channel) ELSE COALESCE(t.clicked,0) END,
   (SELECT count(*) FROM generated g WHERE g.eid=cp.eid AND g.channel=cp.channel),COALESCE(t.delivered,0),t.cost,
   (SELECT count(DISTINCT w.lid) FROM wins w WHERE w.eid=cp.eid AND w.channel=cp.channel),
   COALESCE((SELECT sum(w.value) FROM wins w WHERE w.eid=cp.eid AND w.channel=cp.channel),0)
 FROM cp LEFT JOIN totals t ON t.eid=cp.eid AND t.channel=cp.channel GROUP BY cp.eid,cp.channel,t.sent,t.opened,t.clicked,t.delivered,t.cost;
END $$;
REVOKE ALL ON FUNCTION public.fn_event_campaign_metrics(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_event_campaign_metrics(uuid) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.fn_event_campaign_stats(p_event_id uuid DEFAULT NULL)
RETURNS TABLE(event_id uuid,canal text,campanhas integer,envios bigint,abertos bigint,cliques bigint,leads bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$ SELECT event_id,canal,campanhas,envios,abertos,cliques,leads FROM public.fn_event_campaign_metrics(p_event_id) $$;

CREATE OR REPLACE FUNCTION public.fn_event_store_stats(p_event_id uuid DEFAULT NULL)
RETURNS TABLE(event_id uuid,pedidos bigint,valor_total numeric,pedidos_cupom bigint,valor_cupons numeric,atualizado_em timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF COALESCE(auth.role(),'') <> 'service_role' AND NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Acesso restrito aos administradores' USING ERRCODE='42501'; END IF;
 RETURN QUERY
 WITH ev AS (
   SELECT e.id,(e.start_date::timestamp AT TIME ZONE 'America/Sao_Paulo') starts,((e.end_date+1)::timestamp AT TIME ZONE 'America/Sao_Paulo') ends
   FROM smartops_events e WHERE e.event_type='campanha_promocional' AND e.start_date IS NOT NULL AND e.end_date IS NOT NULL AND (p_event_id IS NULL OR e.id=p_event_id)
 ), snapshots AS (
   SELECT o.numero_pedido::text oid,o.data_pedido order_date,o.synced_at updated,o.status,
     o.valor_total amount,COALESCE(o.cupom_codigo,o.cupom_json->>'codigo') coupon
   FROM loja_integrada_orders o
   UNION ALL
   SELECT COALESCE(a.event_data->>'pedido',a.entity_id),a.event_timestamp,a.created_at,
     CASE a.event_type WHEN 'ecommerce_order_paid' THEN 'paid' WHEN 'ecommerce_order_invoiced' THEN 'invoiced' WHEN 'ecommerce_order_delivered' THEN 'delivered' WHEN 'ecommerce_order_cancelled' THEN 'cancelled' ELSE 'pending' END,
     COALESCE(a.value_numeric,(a.event_data->>'valor')::numeric),a.event_data->'cupom'->>'codigo'
   FROM lead_activity_log a WHERE a.source_channel='ecommerce' AND a.event_type IN ('ecommerce_order_created','ecommerce_order_paid','ecommerce_order_invoiced','ecommerce_order_delivered','ecommerce_order_cancelled')
 ), latest AS (
   SELECT DISTINCT ON(s.oid) s.*,min(s.order_date) OVER(PARTITION BY s.oid) first_date
   FROM snapshots s WHERE s.oid IS NOT NULL ORDER BY s.oid,s.updated DESC NULLS LAST
 ), paid AS (
   SELECT * FROM latest WHERE lower(status) IN ('paid','invoiced','delivered','pedido pago','pedido enviado','pedido entregue','pago','enviado','entregue')
 ), coupons AS (
   SELECT DISTINCT pt.event_id eid,upper(btrim(c.code)) code FROM promotional_tables pt JOIN promotional_coupons c ON c.promotional_table_id=pt.id
 )
 SELECT ev.id,count(p.oid),COALESCE(sum(p.amount),0),count(p.oid) FILTER(WHERE c.code IS NOT NULL),COALESCE(sum(p.amount) FILTER(WHERE c.code IS NOT NULL),0),max(p.updated)
 FROM ev LEFT JOIN paid p ON p.first_date>=ev.starts AND p.first_date<ev.ends
 LEFT JOIN coupons c ON c.eid=ev.id AND c.code=upper(btrim(p.coupon)) GROUP BY ev.id;
END $$;
REVOKE ALL ON FUNCTION public.fn_event_store_stats(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_event_store_stats(uuid) TO authenticated,service_role;

DO $fix$ DECLARE def text; BEGIN
 SELECT pg_get_functiondef('public.fn_event_lead_stats(uuid)'::regprocedure) INTO def;
 IF position('ef.name = a.event_data->>''form_name''' IN def)>0 THEN
   EXECUTE replace(def,'ef.name = a.event_data->>''form_name''','regexp_replace(btrim(ef.name),''^#\s*-\s*'','''') = regexp_replace(btrim(a.event_data->>''form_name''),''^#\s*-\s*'','''')');
 END IF;
END $fix$;

DO $verify$ DECLARE w record; s record; previous text; BEGIN
 previous:=current_setting('request.jwt.claim.role',true);
 PERFORM set_config('request.jwt.claim.role','service_role',true);
 SELECT * INTO w FROM public.fn_event_campaign_metrics('6914e294-2313-4694-93b5-b7736747feae') WHERE canal='whatsapp_oficial';
 IF w.envios IS NULL OR w.envios<1669 THEN RAISE EXCEPTION 'WhatsApp envios ausentes'; END IF;
 IF w.custo <> round(w.entregues*0.35,2) THEN RAISE EXCEPTION 'Custo não corresponde às entregas'; END IF;
 SELECT * INTO s FROM public.fn_event_store_stats('6914e294-2313-4694-93b5-b7736747feae');
 IF s.pedidos<1 OR s.valor_cupons>s.valor_total THEN RAISE EXCEPTION 'Totais da loja inválidos'; END IF;
 RAISE NOTICE 'WhatsApp envios %, entregues %, custo %, leads %, conversões %; loja pedidos %, valor %, cupons %',w.envios,w.entregues,w.custo,w.leads,w.convertidos,s.pedidos,s.valor_total,s.valor_cupons;
 PERFORM set_config('request.jwt.claim.role',COALESCE(previous,''),true);
END $verify$;