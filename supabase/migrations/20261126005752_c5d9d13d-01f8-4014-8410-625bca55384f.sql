CREATE OR REPLACE FUNCTION public.fn_event_campaign_stats(p_event_id uuid DEFAULT NULL)
RETURNS TABLE(event_id uuid, canal text, campanhas int, envios bigint, abertos bigint, cliques bigint, leads bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
WITH ev_forms AS (
  SELECT f.id::text form_id, COALESCE(f.event_id::text, pt.event_id::text)::uuid event_id
  FROM smartops_forms f LEFT JOIN promotional_tables pt ON pt.id::text = f.promotional_table_id::text
  WHERE COALESCE(f.event_id::text, pt.event_id::text) IS NOT NULL
),
camp AS (
  SELECT c.id::text id, c.canal, ef.event_id, ef.form_id
  FROM campaigns c
  LEFT JOIN smartops_form_landing_pages lp ON lp.id::text = c.cta_config->'cta_principal'->>'id'
  JOIN ev_forms ef ON ef.form_id = COALESCE(
      lp.form_id::text,
      (SELECT f2.id::text FROM smartops_forms f2 WHERE f2.name = '[WHTASATIVO] - ' || c.nome LIMIT 1))
  WHERE c.canal IN ('email','whatsapp_oficial')
    AND (p_event_id IS NULL OR ef.event_id = p_event_id)
),
logs AS (
  SELECT cp.event_id, cp.canal, l.lead_id::text lead_id, l.sent_at, l.created_at, l.status, l.opened_at, l.clicked_at
  FROM camp cp JOIN campaign_send_log l ON COALESCE(l.source_campaign_id::text, l.campaign_id::text) = cp.id
)
SELECT cp.event_id, cp.canal, count(DISTINCT cp.id)::int,
  (SELECT count(*) FROM logs x WHERE x.event_id=cp.event_id AND x.canal=cp.canal
     AND (x.sent_at IS NOT NULL OR x.status IN ('sent','delivered','read','opened','clicked'))),
  (SELECT count(*) FROM logs x WHERE x.event_id=cp.event_id AND x.canal=cp.canal AND x.opened_at IS NOT NULL),
  CASE WHEN cp.canal='email' THEN
    (SELECT count(*) FROM logs x WHERE x.event_id=cp.event_id AND x.canal=cp.canal AND x.clicked_at IS NOT NULL)
  ELSE
    (SELECT count(DISTINCT j.phone) FROM wa_campaign_lead_jobs j WHERE j.campaign_id::text IN
       (SELECT c2.id FROM camp c2 WHERE c2.event_id=cp.event_id AND c2.canal=cp.canal))
  END,
  CASE WHEN cp.canal='email' THEN
    (SELECT count(DISTINCT COALESCE(la.merged_into::text, la.id::text)) FROM logs x
       JOIN lead_form_submissions s ON s.lead_id::text = x.lead_id AND s.submitted_at >= COALESCE(x.sent_at, x.created_at)
       JOIN ev_forms ef ON ef.form_id = s.form_id::text AND ef.event_id = cp.event_id
       JOIN lia_attendances la ON la.id::text = x.lead_id
     WHERE x.event_id=cp.event_id AND x.canal='email')
  ELSE
    (SELECT count(DISTINCT COALESCE(la.merged_into::text, la.id::text)) FROM lead_form_submissions s
       JOIN lia_attendances la ON la.id::text = s.lead_id::text
     WHERE s.form_id::text IN (SELECT c2.form_id FROM camp c2 WHERE c2.event_id=cp.event_id AND c2.canal=cp.canal))
  END
FROM camp cp GROUP BY cp.event_id, cp.canal;
$$;
REVOKE ALL ON FUNCTION public.fn_event_campaign_stats(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.fn_event_campaign_stats(uuid) TO authenticated, service_role;