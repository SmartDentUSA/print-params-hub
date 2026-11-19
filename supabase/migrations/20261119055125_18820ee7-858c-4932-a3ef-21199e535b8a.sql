CREATE OR REPLACE FUNCTION public.fn_event_form_lead_counts()
RETURNS TABLE(event_id uuid, visitor_leads bigint, kol_expansion_leads bigint, kol_seller_leads bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' SET statement_timeout TO '8s'
AS $$
WITH forms AS (SELECT id, event_id, name, form_purpose FROM smartops_forms WHERE event_id IS NOT NULL AND form_purpose IN ('feira_evento','kol_expansao')),
subs AS (
  SELECT f.event_id, f.form_purpose, coalesce(l.merged_into, l.id) lead_id
  FROM lead_activity_log a JOIN forms f ON a.event_data->>'form_id' = f.id::text
  JOIN lia_attendances l ON l.id = a.lead_id
  WHERE a.event_type = 'form_submission'
  UNION
  SELECT f.event_id, f.form_purpose, l.id FROM lia_attendances l JOIN forms f ON f.name = l.form_name WHERE l.merged_into IS NULL
),
sellers AS (
  SELECT (a.event_data->>'event_id')::uuid event_id, count(DISTINCT coalesce(l.merged_into, l.id)) qty
  FROM lead_activity_log a JOIN lia_attendances l ON l.id = a.lead_id
  WHERE a.event_type = 'crm_insercao' AND a.event_data->>'event_id' ~ '^[0-9a-f-]{36}$'
  GROUP BY 1
),
evs AS (SELECT DISTINCT event_id FROM forms UNION SELECT event_id FROM sellers)
SELECT e.event_id,
  (SELECT count(DISTINCT lead_id) FROM subs s WHERE s.event_id = e.event_id AND s.form_purpose = 'feira_evento'),
  (SELECT count(DISTINCT lead_id) FROM subs s WHERE s.event_id = e.event_id AND s.form_purpose = 'kol_expansao'),
  coalesce((SELECT qty FROM sellers s WHERE s.event_id = e.event_id), 0)
FROM evs e;
$$;
REVOKE ALL ON FUNCTION public.fn_event_form_lead_counts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_event_form_lead_counts() TO service_role;