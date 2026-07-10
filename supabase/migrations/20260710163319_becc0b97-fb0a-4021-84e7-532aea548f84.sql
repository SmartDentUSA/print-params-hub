
CREATE INDEX IF NOT EXISTS idx_lia_attendances_form_name_active
  ON public.lia_attendances (form_name)
  WHERE merged_into IS NULL;

CREATE INDEX IF NOT EXISTS idx_lead_page_views_path_time
  ON public.lead_page_views (page_path, viewed_at);

CREATE INDEX IF NOT EXISTS idx_loja_integrada_orders_attendance
  ON public.loja_integrada_orders (attendance_id, created_at);

CREATE OR REPLACE FUNCTION public.fn_form_metrics(p_period_days integer DEFAULT 30)
 RETURNS TABLE(form_id uuid, visitors bigint, unique_visitors bigint, leads bigint, deals_won bigint, daily_series jsonb)
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '30s'
AS $function$
  WITH period AS (
    SELECT CASE WHEN p_period_days <= 0 THEN '1900-01-01'::timestamptz
                ELSE (now() - (p_period_days || ' days')::interval) END AS since
  ),
  f AS (
    SELECT id, slug, name FROM smartops_forms
  ),
  -- Mapeamento path -> form_id (usado para um único scan de lead_page_views)
  path_map AS (
    SELECT '/f/' || slug AS page_path, id AS form_id FROM f
    UNION ALL
    SELECT '/f/lp/' || slug AS page_path, id AS form_id FROM f
  ),
  pv_raw AS (
    SELECT pm.form_id,
           lpv.session_id,
           date_trunc('day', lpv.viewed_at)::date AS day
    FROM lead_page_views lpv
    JOIN path_map pm ON pm.page_path = lpv.page_path
    WHERE lpv.viewed_at >= (SELECT since FROM period)
  ),
  pv AS (
    SELECT form_id,
           count(*)::bigint AS visitors,
           count(DISTINCT session_id)::bigint AS unique_visitors
    FROM pv_raw
    GROUP BY form_id
  ),
  series AS (
    SELECT form_id,
           coalesce(
             jsonb_agg(jsonb_build_object('d', day, 'v', cnt) ORDER BY day),
             '[]'::jsonb
           ) AS daily_series
    FROM (
      SELECT form_id, day, count(*)::int AS cnt
      FROM pv_raw
      GROUP BY form_id, day
    ) s
    GROUP BY form_id
  ),
  -- Um único scan em lia_attendances, casando por form_name
  la_scan AS (
    SELECT f.id AS form_id,
           la.id AS attendance_id,
           la.created_at,
           la.piperun_deals_history
    FROM lia_attendances la
    JOIN f ON f.name = la.form_name
    WHERE la.merged_into IS NULL
      AND la.created_at >= (SELECT since FROM period)
      AND coalesce(la.source,'') NOT IN ('loja_integrada','astron_postback')
  ),
  ld AS (
    SELECT form_id, count(DISTINCT attendance_id)::bigint AS leads
    FROM la_scan
    GROUP BY form_id
  ),
  wins AS (
    SELECT form_id, count(DISTINCT attendance_id)::bigint AS deals_won
    FROM la_scan las
    WHERE
      (
        jsonb_typeof(las.piperun_deals_history) = 'array'
        AND jsonb_array_length(las.piperun_deals_history) > 0
        AND EXISTS (
          SELECT 1
          FROM jsonb_array_elements(las.piperun_deals_history) d
          WHERE lower(coalesce(d->>'status','')) = 'ganha'
            AND public.fn_smartops_parse_timestamp(d->>'closed_at') > las.created_at
        )
      )
      OR EXISTS (
        SELECT 1 FROM loja_integrada_orders o
        WHERE o.attendance_id = las.attendance_id
          AND o.created_at > las.created_at
      )
    GROUP BY form_id
  )
  SELECT f.id,
         coalesce(pv.visitors, 0),
         coalesce(pv.unique_visitors, 0),
         coalesce(ld.leads, 0),
         coalesce(wins.deals_won, 0),
         coalesce(series.daily_series, '[]'::jsonb)
  FROM f
  LEFT JOIN pv ON pv.form_id = f.id
  LEFT JOIN ld ON ld.form_id = f.id
  LEFT JOIN wins ON wins.form_id = f.id
  LEFT JOIN series ON series.form_id = f.id;
$function$;
