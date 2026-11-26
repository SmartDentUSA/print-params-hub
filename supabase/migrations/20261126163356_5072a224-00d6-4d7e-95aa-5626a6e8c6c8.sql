-- Optional event association for email, Evolution, official WhatsApp, SMS and Push.
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES public.smartops_events(id) ON DELETE SET NULL;
ALTER TABLE public.campaign_sessions ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES public.smartops_events(id) ON DELETE SET NULL;
ALTER TABLE public.push_campaigns ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES public.smartops_events(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS campaigns_event_idx ON public.campaigns(event_id) WHERE event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS campaign_sessions_event_idx ON public.campaign_sessions(event_id) WHERE event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS push_campaigns_event_idx ON public.push_campaigns(event_id) WHERE event_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.fn_event_campaign_metrics(p_event_id uuid DEFAULT NULL)
RETURNS TABLE(event_id uuid, canal text, campanhas integer, envios bigint, abertos bigint, cliques bigint, leads bigint, entregues bigint, custo numeric, convertidos bigint, valor_convertido numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $function$
BEGIN
 IF COALESCE(auth.role(),'') <> 'service_role' AND NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Acesso restrito aos administradores' USING ERRCODE='42501'; END IF;
 RETURN QUERY
 WITH forms AS (
   SELECT f.id, regexp_replace(btrim(f.name),'^#\s*-\s*','') name, COALESCE(f.event_id,pt.event_id) eid
   FROM smartops_forms f LEFT JOIN promotional_tables pt ON pt.id=f.promotional_table_id
   WHERE COALESCE(f.event_id,pt.event_id) IS NOT NULL
 ), candidates AS (
   SELECT c.id,c.canal channel,COALESCE(c.event_id,f.eid) eid,f.id fid,c.metadata
   FROM campaigns c LEFT JOIN smartops_form_landing_pages lp ON lp.id::text=c.cta_config->'cta_principal'->>'id'
   LEFT JOIN forms f ON (c.event_id IS NULL OR f.eid=c.event_id) AND (f.id=lp.form_id OR (c.canal='whatsapp_oficial' AND (f.name='[WHTASATIVO] - '||c.nome OR EXISTS(SELECT 1 FROM wa_campaign_lead_jobs j WHERE j.campaign_id=c.id AND j.form_id=f.id))))
   WHERE c.canal IN ('email','whatsapp_oficial','sms','evolution','whatsapp')
   UNION ALL
   SELECT s.id,s.channel,s.event_id,NULL::uuid,s.results FROM campaign_sessions s
   WHERE s.event_id IS NOT NULL AND s.channel IN ('email','whatsapp_oficial','sms','evolution','whatsapp')
   AND NOT EXISTS (SELECT 1 FROM campaigns c WHERE c.id::text=s.results->>'campaign_id')
   AND NOT EXISTS (SELECT 1 FROM campaign_send_log l JOIN campaigns c ON c.id=l.source_campaign_id WHERE l.campaign_id=s.id)
 ), cp AS (
   SELECT DISTINCT * FROM candidates c WHERE c.eid IS NOT NULL AND (p_event_id IS NULL OR c.eid=p_event_id)
 ), logs AS (
   SELECT DISTINCT cp.eid,cp.channel,cp.id cid,cp.metadata,l.*
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
 FROM cp LEFT JOIN totals t ON t.eid=cp.eid AND t.channel=cp.channel GROUP BY cp.eid,cp.channel,t.sent,t.opened,t.clicked,t.delivered,t.cost
 UNION ALL
 SELECT p.event_id,'push'::text,count(*)::integer,COALESCE(sum(p.sent_count),0)::bigint,0::bigint,COALESCE(sum(p.clicked_count),0)::bigint,0::bigint,0::bigint,NULL::numeric,0::bigint,0::numeric
 FROM push_campaigns p WHERE p.event_id IS NOT NULL AND (p_event_id IS NULL OR p.event_id=p_event_id) GROUP BY p.event_id;
END $function$;
REVOKE ALL ON FUNCTION public.fn_event_campaign_metrics(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_event_campaign_metrics(uuid) TO authenticated,service_role;