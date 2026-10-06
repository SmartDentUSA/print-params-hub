CREATE OR REPLACE FUNCTION public.fn_form_metrics(p_period_days integer DEFAULT 30)
 RETURNS TABLE(form_id uuid, visitors bigint, unique_visitors bigint, leads bigint, deals_won bigint, daily_series jsonb)
 LANGUAGE sql STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '30s'
AS $function$
  WITH period AS (
    SELECT CASE WHEN p_period_days <= 0 THEN '1900-01-01'::timestamptz
                ELSE (now() - (p_period_days || ' days')::interval) END AS since
  ),
  f AS (SELECT id, slug, name FROM smartops_forms),
  path_map AS (
    SELECT '/f/' || slug AS page_path, id AS form_id FROM f
    UNION ALL
    SELECT '/f/lp/' || slug, id FROM f
  ),
  pv_raw AS (
    SELECT pm.form_id, lpv.session_id, date_trunc('day', lpv.viewed_at)::date AS day
    FROM lead_page_views lpv
    JOIN path_map pm ON pm.page_path = lpv.page_path
    WHERE lpv.viewed_at >= (SELECT since FROM period)
  ),
  pv AS (
    SELECT form_id, count(*)::bigint AS visitors, count(DISTINCT session_id)::bigint AS unique_visitors
    FROM pv_raw GROUP BY form_id
  ),
  series AS (
    SELECT form_id, coalesce(jsonb_agg(jsonb_build_object('d', day, 'v', cnt) ORDER BY day), '[]'::jsonb) AS daily_series
    FROM (SELECT form_id, day, count(*)::int AS cnt FROM pv_raw GROUP BY form_id, day) s
    GROUP BY form_id
  ),
  sub_raw AS (
    SELECT f.id AS form_id, l.lead_id AS raw_lead, l.event_timestamp AS at
    FROM lead_activity_log l
    JOIN f ON f.name = l.event_data->>'form_name'
    WHERE l.event_type = 'form_submission'
    UNION ALL
    SELECT f.id, la.id, la.created_at
    FROM lia_attendances la
    JOIN f ON f.name = la.form_name
    WHERE coalesce(la.source,'') NOT IN ('loja_integrada','astron_postback')
  ),
  subs AS (
    SELECT sr.form_id, COALESCE(la.merged_into, la.id) AS lead_id, min(sr.at) AS first_at
    FROM sub_raw sr JOIN lia_attendances la ON la.id = sr.raw_lead
    GROUP BY 1, 2
    HAVING min(sr.at) >= (SELECT since FROM period)
  ),
  won AS MATERIALIZED (
    SELECT COALESCE(dl.merged_into, dl.id) AS lead_id,
           max(public.fn_deal_won_at(d.closed_at, d.piperun_updated_at)) AS last_won_at
    FROM deals d JOIN lia_attendances dl ON dl.id = d.lead_id
    WHERE d.status = 'ganha' AND COALESCE(d.is_deleted, false) = false
    GROUP BY 1
    UNION ALL
    SELECT o.attendance_id, max(o.created_at) FROM loja_integrada_orders o
    WHERE o.attendance_id IS NOT NULL GROUP BY 1
  ),
  ld AS (SELECT form_id, count(*)::bigint AS leads FROM subs GROUP BY form_id),
  wins AS (
    SELECT s.form_id, count(DISTINCT s.lead_id)::bigint AS deals_won
    FROM subs s JOIN won w ON w.lead_id = s.lead_id AND w.last_won_at > s.first_at
    GROUP BY s.form_id
  )
  SELECT f.id, coalesce(pv.visitors, 0), coalesce(pv.unique_visitors, 0),
         coalesce(ld.leads, 0), coalesce(wins.deals_won, 0), coalesce(series.daily_series, '[]'::jsonb)
  FROM f
  LEFT JOIN pv ON pv.form_id = f.id
  LEFT JOIN ld ON ld.form_id = f.id
  LEFT JOIN wins ON wins.form_id = f.id
  LEFT JOIN series ON series.form_id = f.id;
$function$;

CREATE OR REPLACE FUNCTION public.fn_campaign_conversions(p_campaign_id uuid)
 RETURNS TABLE(conversions integer, deals_created integer, won_deals integer, revenue numeric)
 LANGUAGE sql STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH sends AS (
    SELECT COALESCE(la.merged_into, s.lead_id) AS lead_id, min(s.sent_at) AS sent_at
    FROM public.campaign_send_log s
    LEFT JOIN public.lia_attendances la ON la.id = s.lead_id
    WHERE (s.campaign_id = p_campaign_id OR s.source_campaign_id = p_campaign_id)
      AND s.sent_at IS NOT NULL AND s.lead_id IS NOT NULL
    GROUP BY 1
  ),
  lead_ids AS (
    SELECT s.lead_id AS canon, s.lead_id AS raw, s.sent_at FROM sends s
    UNION
    SELECT s.lead_id, m.id, s.sent_at FROM sends s JOIN public.lia_attendances m ON m.merged_into = s.lead_id
  ),
  cand AS (
    SELECT li.canon AS lead_id, li.sent_at, d.id AS deal_id, d.status, d.value,
           COALESCE(d.piperun_created_at, d.created_at) AS deal_created_at,
           public.fn_deal_won_at(d.closed_at, d.piperun_updated_at) AS won_at
    FROM lead_ids li
    JOIN public.deals d ON d.lead_id = li.raw AND COALESCE(d.is_deleted, false) = false
  ),
  opened AS (SELECT DISTINCT deal_id FROM cand WHERE deal_created_at > sent_at),
  won AS (SELECT DISTINCT ON (deal_id) deal_id, lead_id, value FROM cand
          WHERE status = 'ganha' AND won_at > sent_at)
  SELECT
    (SELECT count(DISTINCT lead_id) FROM won)::integer,
    (SELECT count(*) FROM opened)::integer,
    (SELECT count(*) FROM won)::integer,
    COALESCE((SELECT sum(value) FROM won), 0)::numeric;
$function$;