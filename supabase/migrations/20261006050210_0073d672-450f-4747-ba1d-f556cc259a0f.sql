CREATE INDEX IF NOT EXISTS idx_lal_form_submission_name
  ON public.lead_activity_log ((event_data->>'form_name'))
  WHERE event_type = 'form_submission';

-- Data efetiva de ganho: closed_at, ou última atualização do PipeRun quando ausente
CREATE OR REPLACE FUNCTION public.fn_deal_won_at(p_closed_at timestamptz, p_piperun_updated_at timestamptz)
RETURNS timestamptz LANGUAGE sql IMMUTABLE AS $$ SELECT COALESCE(p_closed_at, p_piperun_updated_at) $$;

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
  -- Todos os envios do formulário (histórico), resolvidos para o lead canônico
  sub_raw AS (
    SELECT f.id AS form_id, COALESCE(la.merged_into, la.id) AS lead_id, l.event_timestamp AS at
    FROM lead_activity_log l
    JOIN f ON f.name = l.event_data->>'form_name'
    JOIN lia_attendances la ON la.id = l.lead_id
    WHERE l.event_type = 'form_submission'
    UNION ALL
    -- fallback: leads antigos sem evento de envio registrado
    SELECT f.id, COALESCE(la.merged_into, la.id), la.created_at
    FROM lia_attendances la
    JOIN f ON f.name = la.form_name
    WHERE coalesce(la.source,'') NOT IN ('loja_integrada','astron_postback')
  ),
  subs AS (
    SELECT form_id, lead_id, min(at) AS first_at
    FROM sub_raw WHERE lead_id IS NOT NULL
    GROUP BY form_id, lead_id
    HAVING min(at) >= (SELECT since FROM period)
  ),
  ld AS (SELECT form_id, count(*)::bigint AS leads FROM subs GROUP BY form_id),
  wins AS (
    SELECT s.form_id, count(*)::bigint AS deals_won
    FROM subs s
    WHERE EXISTS (
        SELECT 1 FROM deals d
        JOIN lia_attendances dl ON dl.id = d.lead_id
        WHERE COALESCE(dl.merged_into, dl.id) = s.lead_id
          AND d.status = 'ganha'
          AND COALESCE(d.is_deleted, false) = false
          AND public.fn_deal_won_at(d.closed_at, d.piperun_updated_at) > s.first_at
      )
      OR EXISTS (
        SELECT 1 FROM loja_integrada_orders o
        WHERE o.attendance_id = s.lead_id AND o.created_at > s.first_at
      )
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

CREATE OR REPLACE FUNCTION public.fn_kol_form_leads(_names text[])
 RETURNS TABLE(form_key text, lead_id uuid)
 LANGUAGE sql STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT form_key, lead_id FROM (
    SELECT n.name AS form_key, COALESCE(l.merged_into, l.id) AS lead_id
    FROM unnest(_names) AS n(name)
    JOIN public.lia_attendances l ON l.form_name = n.name
    UNION
    SELECT n.name, COALESCE(l.merged_into, l.id)
    FROM unnest(_names) AS n(name)
    JOIN LATERAL (SELECT id, merged_into FROM public.lia_attendances WHERE form_data ? n.name) l ON true
    UNION
    SELECT n.name, COALESCE(la.merged_into, la.id)
    FROM unnest(_names) AS n(name)
    JOIN public.lead_activity_log a ON a.event_type = 'form_submission' AND a.event_data->>'form_name' = n.name
    JOIN public.lia_attendances la ON la.id = a.lead_id
  ) s
$function$;

DROP FUNCTION IF EXISTS public.fn_campaign_conversions(uuid);
CREATE FUNCTION public.fn_campaign_conversions(p_campaign_id uuid)
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
  cand AS (
    SELECT s.lead_id, s.sent_at, d.id AS deal_id, d.status, d.value,
           COALESCE(d.piperun_created_at, d.created_at) AS deal_created_at,
           public.fn_deal_won_at(d.closed_at, d.piperun_updated_at) AS won_at
    FROM sends s
    JOIN public.lia_attendances dl ON COALESCE(dl.merged_into, dl.id) = s.lead_id
    JOIN public.deals d ON d.lead_id = dl.id AND COALESCE(d.is_deleted, false) = false
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
GRANT EXECUTE ON FUNCTION public.fn_campaign_conversions(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.fn_campaign_revenue(p_from date, p_to date)
 RETURNS TABLE(platform_campaign_id text, revenue numeric, won_deals bigint, won_leads bigint, leads_converted bigint, avg_lead_time_days numeric)
 LANGUAGE sql STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
WITH ad_events AS (
  SELECT l.lead_id,
         COALESCE(NULLIF(l.event_data #>> '{lead,campaignId}', ''), NULLIF(l.event_data ->> 'platform_campaign_id', ''), NULLIF(l.event_data ->> 'campaign_id', '')) AS cid,
         l.event_timestamp AS converted_at
  FROM public.lead_activity_log l
  JOIN public.lia_attendances la ON la.id = l.lead_id AND la.merged_into IS NULL
  WHERE l.event_type IN ('zernio_lead_raw', 'meta_ads_lead_entry')
), exact_conversions AS (
  SELECT lead_id, cid, MAX(converted_at) AS converted_at
  FROM ad_events WHERE cid IS NOT NULL GROUP BY lead_id, cid
), fallback_conversions AS (
  SELECT la.id, la.platform_campaign_id::text,
         COALESCE((SELECT MAX(e.converted_at) FROM ad_events e WHERE e.lead_id = la.id), la.entrada_sistema, la.created_at)
  FROM public.lia_attendances la
  WHERE la.merged_into IS NULL AND la.platform_campaign_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM exact_conversions e WHERE e.lead_id = la.id)
), conversions AS (
  SELECT * FROM exact_conversions UNION ALL SELECT * FROM fallback_conversions
), period_conversions AS (
  SELECT * FROM conversions WHERE converted_at::date BETWEEN p_from AND p_to
), won_candidates AS (
  SELECT d.id AS deal_id, d.piperun_deal_id, d.lead_id,
         COALESCE(d.value, d.value_products, 0)::numeric AS deal_value,
         public.fn_deal_won_at(d.closed_at, d.piperun_updated_at) AS closed_at,
         COALESCE(d.piperun_created_at, d.created_at) AS deal_created_at,
         d.pipeline_name, c.cid, c.converted_at,
         ROW_NUMBER() OVER (PARTITION BY d.id ORDER BY c.converted_at DESC, c.cid) AS attribution_rank
  FROM public.deals d
  JOIN period_conversions c ON c.lead_id = d.lead_id
   AND c.converted_at <= public.fn_deal_won_at(d.closed_at, d.piperun_updated_at)
  WHERE d.status = 'ganha'
    AND public.fn_deal_won_at(d.closed_at, d.piperun_updated_at) IS NOT NULL
    AND COALESCE(d.is_deleted, false) = false
), attributed_won AS (
  SELECT * FROM won_candidates WHERE attribution_rank = 1
), journeys AS (
  SELECT w.*,
         COALESCE(
           (SELECT MIN(t.transitioned_at) FROM public.piperun_stage_transitions t
            WHERE t.lead_id = w.lead_id AND t.deal_id = w.piperun_deal_id::text
              AND (t.pipeline_name ILIKE '%cs%' OR t.pipeline_name ILIKE '%onboarding%')
              AND t.transitioned_at >= w.deal_created_at),
           CASE WHEN w.pipeline_name ILIKE '%cs%' OR w.pipeline_name ILIKE '%onboarding%' THEN w.closed_at END
         ) AS cs_at
  FROM attributed_won w
), campaigns AS (
  SELECT DISTINCT cid FROM period_conversions
)
SELECT c.cid,
       COALESCE(SUM(j.deal_value), 0)::numeric,
       COUNT(j.deal_id)::bigint,
       COUNT(DISTINCT j.lead_id)::bigint,
       (SELECT COUNT(DISTINCT pc.lead_id) FROM period_conversions pc WHERE pc.cid = c.cid)::bigint,
       ROUND(AVG(CASE WHEN j.cs_at IS NOT NULL AND j.deal_created_at IS NOT NULL AND j.cs_at >= j.deal_created_at
                      THEN EXTRACT(EPOCH FROM (j.cs_at - j.deal_created_at)) / 86400 END)::numeric, 1)
FROM campaigns c LEFT JOIN journeys j ON j.cid = c.cid
GROUP BY c.cid;
$function$;