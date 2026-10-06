CREATE OR REPLACE FUNCTION public.fn_form_revenue(p_period_days integer DEFAULT 0)
RETURNS TABLE(form_id uuid, revenue numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH period AS (
    SELECT CASE WHEN p_period_days <= 0 THEN '1900-01-01'::timestamptz
                ELSE (now() - (p_period_days || ' days')::interval) END AS since
  ),
  f AS (SELECT id, name FROM smartops_forms),
  sub_raw AS (
    SELECT f.id AS form_id, l.lead_id AS raw_lead, l.event_timestamp AS at
    FROM lead_activity_log l JOIN f ON f.name = l.event_data->>'form_name'
    WHERE l.event_type = 'form_submission'
    UNION ALL
    SELECT f.id, la.id, la.created_at FROM lia_attendances la JOIN f ON f.name = la.form_name
    WHERE coalesce(la.source,'') NOT IN ('loja_integrada','astron_postback')
    UNION ALL
    SELECT f.id, d.lead_id, coalesce(d.piperun_created_at, d.created_at) - interval '1 second'
    FROM deals d JOIN f ON f.name = d.origin_name
    WHERE d.lead_id IS NOT NULL AND COALESCE(d.is_deleted, false) = false
  ),
  subs AS (
    SELECT sr.form_id, COALESCE(la.merged_into, la.id) AS lead_id, min(sr.at) AS first_at
    FROM sub_raw sr JOIN lia_attendances la ON la.id = sr.raw_lead
    GROUP BY 1, 2 HAVING min(sr.at) >= (SELECT since FROM period)
  ),
  won AS MATERIALIZED (
    SELECT d.id, COALESCE(dl.merged_into, dl.id) AS lead_id, COALESCE(d.value, 0)::numeric AS v,
           public.fn_deal_won_at(d.closed_at, d.piperun_updated_at) AS won_at
    FROM deals d JOIN lia_attendances dl ON dl.id = d.lead_id
    WHERE d.status = 'ganha' AND COALESCE(d.is_deleted, false) = false
  )
  SELECT s.form_id, COALESCE(SUM(w.v), 0)
  FROM subs s JOIN won w ON w.lead_id = s.lead_id AND w.won_at > s.first_at
  GROUP BY s.form_id;
$$;
GRANT EXECUTE ON FUNCTION public.fn_form_revenue(integer) TO authenticated, service_role;