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
 prev AS (
   SELECT s.ev, (
     SELECT NULLIF(btrim(d.pipeline_name),'') FROM deals d
     WHERE COALESCE(d.is_deleted,false)=false
       AND d.lead_id IN (SELECT s.lead_id UNION SELECT x.id FROM lia_attendances x WHERE x.merged_into=s.lead_id)
       AND COALESCE(d.piperun_created_at,d.created_at) < s.ts - interval '10 minutes'
     ORDER BY COALESCE(d.piperun_created_at,d.created_at) DESC LIMIT 1) f
   FROM sub s
 )
 SELECT prev.ev, COALESCE(prev.f,'Sem negócio anterior (lead novo no CRM)'), count(*)::bigint FROM prev GROUP BY 1,2;
END $$;
REVOKE ALL ON FUNCTION public.fn_event_previous_funnel(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_event_previous_funnel(uuid) TO authenticated, service_role;