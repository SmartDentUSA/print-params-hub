
CREATE OR REPLACE FUNCTION public.fn_form_metrics(p_period_days int DEFAULT 30)
RETURNS TABLE (
  form_id uuid,
  visitors bigint,
  unique_visitors bigint,
  leads bigint,
  deals_won bigint,
  daily_series jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH period AS (
    SELECT CASE WHEN p_period_days <= 0 THEN '1900-01-01'::timestamptz
                ELSE (now() - (p_period_days || ' days')::interval) END AS since
  ),
  f AS (SELECT id, slug FROM smartops_forms),
  pv AS (
    SELECT f.id AS form_id,
           count(lpv.*)::bigint AS visitors,
           count(DISTINCT lpv.session_id)::bigint AS unique_visitors
    FROM f
    LEFT JOIN lead_page_views lpv
      ON lpv.page_path = '/f/' || f.slug
     AND lpv.viewed_at >= (SELECT since FROM period)
    GROUP BY f.id
  ),
  ld AS (
    SELECT f.id AS form_id,
           count(DISTINCT r.lead_id)::bigint AS leads
    FROM f
    LEFT JOIN smartops_form_field_responses r
      ON r.form_id = f.id
     AND r.created_at >= (SELECT since FROM period)
     AND r.lead_id IS NOT NULL
    GROUP BY f.id
  ),
  wins AS (
    SELECT f.id AS form_id, count(DISTINCT la.id)::bigint AS deals_won
    FROM f
    JOIN smartops_form_field_responses r
      ON r.form_id = f.id
     AND r.created_at >= (SELECT since FROM period)
    JOIN lia_attendances la
      ON la.id = r.lead_id
     AND la.merged_into IS NULL
    WHERE EXISTS (
      SELECT 1 FROM jsonb_array_elements(coalesce(la.piperun_deals_history,'[]'::jsonb)) d
      WHERE lower(coalesce(d->>'status','')) = 'ganha'
    )
    GROUP BY f.id
  ),
  series AS (
    SELECT f.id AS form_id,
           coalesce(jsonb_agg(jsonb_build_object('d', s.day, 'v', s.cnt) ORDER BY s.day), '[]'::jsonb) AS daily_series
    FROM f
    LEFT JOIN LATERAL (
      SELECT date_trunc('day', lpv.viewed_at)::date AS day, count(*)::int AS cnt
      FROM lead_page_views lpv
      WHERE lpv.page_path = '/f/' || f.slug
        AND lpv.viewed_at >= (SELECT since FROM period)
      GROUP BY 1
    ) s ON TRUE
    GROUP BY f.id
  )
  SELECT f.id,
         coalesce(pv.visitors,0),
         coalesce(pv.unique_visitors,0),
         coalesce(ld.leads,0),
         coalesce(wins.deals_won,0),
         coalesce(series.daily_series,'[]'::jsonb)
  FROM f
  LEFT JOIN pv ON pv.form_id = f.id
  LEFT JOIN ld ON ld.form_id = f.id
  LEFT JOIN wins ON wins.form_id = f.id
  LEFT JOIN series ON series.form_id = f.id;
$$;
