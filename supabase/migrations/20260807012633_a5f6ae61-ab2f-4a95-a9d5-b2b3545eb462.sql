CREATE OR REPLACE FUNCTION public.fn_campaign_revenue(p_from date, p_to date)
 RETURNS TABLE(platform_campaign_id text, revenue numeric, won_deals bigint, won_leads bigint, leads_converted bigint, avg_lead_time_days numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH conv AS (
    SELECT la.id AS lead_id,
           la.platform_campaign_id::text AS cid,
           COALESCE(
             (SELECT MAX(l.event_timestamp)
                FROM public.lead_activity_log l
               WHERE l.lead_id = la.id
                 AND l.event_type IN ('meta_ads_lead_entry','zernio_lead_raw')),
             la.entrada_sistema,
             la.created_at
           ) AS conv_at
      FROM public.lia_attendances la
     WHERE la.merged_into IS NULL
       AND la.platform_campaign_id IS NOT NULL
  ), period_conv AS (
    SELECT * FROM conv WHERE conv_at::date BETWEEN p_from AND p_to
  ), won AS (
    SELECT c.cid,
           c.lead_id,
           d.id AS deal_id,
           COALESCE(d.value, d.value_products, 0) AS deal_value,
           d.closed_at
      FROM conv c
      JOIN public.deals d ON d.lead_id = c.lead_id
     WHERE d.status = 'ganha'
       AND d.closed_at IS NOT NULL
       AND d.closed_at >= c.conv_at
       AND d.closed_at::date BETWEEN p_from AND p_to
  ), cohort_lead_time AS (
    SELECT c.cid,
           c.lead_id,
           journey.lead_time_days
      FROM period_conv c
      JOIN LATERAL (
        SELECT MIN(EXTRACT(EPOCH FROM (x.cs_at - x.deal_created_at)) / 86400) AS lead_time_days
          FROM (
            SELECT COALESCE(d.piperun_created_at, d.created_at) AS deal_created_at,
                   COALESCE(
                     (SELECT MIN(t.transitioned_at)
                        FROM public.piperun_stage_transitions t
                       WHERE t.lead_id = c.lead_id
                         AND t.deal_id = d.piperun_deal_id::text
                         AND (t.pipeline_name ILIKE '%cs%' OR t.pipeline_name ILIKE '%onboarding%')
                         AND t.transitioned_at >= c.conv_at),
                     CASE WHEN d.pipeline_name ILIKE '%cs%' OR d.pipeline_name ILIKE '%onboarding%'
                          THEN d.closed_at END
                   ) AS cs_at
              FROM public.deals d
             WHERE d.lead_id = c.lead_id
               AND d.status = 'ganha'
               AND d.closed_at IS NOT NULL
               AND d.closed_at >= c.conv_at
               AND COALESCE(d.is_deleted, false) = false
          ) x
         WHERE x.cs_at IS NOT NULL
           AND x.deal_created_at IS NOT NULL
           AND x.cs_at >= x.deal_created_at
      ) journey ON journey.lead_time_days IS NOT NULL
  )
  SELECT c.cid,
         COALESCE((SELECT SUM(w.deal_value) FROM won w WHERE w.cid = c.cid), 0)::numeric,
         COALESCE((SELECT COUNT(*) FROM won w WHERE w.cid = c.cid), 0)::bigint,
         COALESCE((SELECT COUNT(DISTINCT w.lead_id) FROM won w WHERE w.cid = c.cid), 0)::bigint,
         (SELECT COUNT(DISTINCT pc.lead_id) FROM period_conv pc WHERE pc.cid = c.cid)::bigint,
         (SELECT ROUND(AVG(lt.lead_time_days)::numeric, 1)
            FROM cohort_lead_time lt
           WHERE lt.cid = c.cid)
    FROM conv c
   GROUP BY c.cid
$function$;

CREATE OR REPLACE FUNCTION public.fn_campaign_revenue_detail(p_campaign_id text, p_from date, p_to date)
 RETURNS TABLE(lead_id uuid, lead_name text, deal_id uuid, piperun_deal_id text, deal_title text, pipeline_name text, deal_value numeric, converted_at timestamp with time zone, closed_at timestamp with time zone, vendas_at timestamp with time zone, cs_at timestamp with time zone, lead_time_days numeric, campaign_product text, purchased_products text[], cross_sell boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH conv AS (
    SELECT la.id AS lead_id,
           la.nome AS lead_name,
           la.produto_interesse AS campaign_product,
           COALESCE(
             (SELECT MAX(l.event_timestamp)
                FROM public.lead_activity_log l
               WHERE l.lead_id = la.id
                 AND l.event_type IN ('meta_ads_lead_entry','zernio_lead_raw')),
             la.entrada_sistema,
             la.created_at
           ) AS conv_at
      FROM public.lia_attendances la
     WHERE la.merged_into IS NULL
       AND la.platform_campaign_id::text = p_campaign_id
  )
  SELECT c.lead_id,
         c.lead_name,
         d.id,
         d.piperun_deal_id,
         d.deal_title,
         d.pipeline_name,
         COALESCE(d.value, d.value_products, 0)::numeric,
         c.conv_at,
         d.closed_at,
         COALESCE(d.piperun_created_at, d.created_at),
         journey.cs_at,
         CASE WHEN journey.cs_at IS NOT NULL
                   AND COALESCE(d.piperun_created_at, d.created_at) IS NOT NULL
                   AND journey.cs_at >= COALESCE(d.piperun_created_at, d.created_at)
              THEN ROUND((EXTRACT(EPOCH FROM (journey.cs_at - COALESCE(d.piperun_created_at, d.created_at))) / 86400)::numeric, 1) END,
         c.campaign_product,
         COALESCE(items.names, ARRAY[]::text[]),
         CASE
           WHEN c.campaign_product IS NULL OR items.names IS NULL THEN NULL
           ELSE NOT EXISTS (
             SELECT 1 FROM unnest(items.names) n
              WHERE lower(n) LIKE '%' || lower(split_part(c.campaign_product, ' ', 1)) || '%'
           )
         END
    FROM conv c
    JOIN public.deals d ON d.lead_id = c.lead_id
    LEFT JOIN LATERAL (
      SELECT COALESCE(
               (SELECT MIN(t.transitioned_at)
                  FROM public.piperun_stage_transitions t
                 WHERE t.lead_id = c.lead_id
                   AND t.deal_id = d.piperun_deal_id::text
                   AND (t.pipeline_name ILIKE '%cs%' OR t.pipeline_name ILIKE '%onboarding%')
                   AND t.transitioned_at >= c.conv_at),
               CASE WHEN d.pipeline_name ILIKE '%cs%' OR d.pipeline_name ILIKE '%onboarding%'
                    THEN d.closed_at END
             ) AS cs_at
    ) journey ON TRUE
    LEFT JOIN LATERAL (
      SELECT array_agg(DISTINCT COALESCE(di.product_name, di.nome_produto)) AS names
        FROM public.deal_items di
       WHERE di.deal_id = d.piperun_deal_id
         AND COALESCE(di.product_name, di.nome_produto) IS NOT NULL
    ) items ON TRUE
   WHERE d.status = 'ganha'
     AND d.closed_at IS NOT NULL
     AND d.closed_at >= c.conv_at
     AND c.conv_at::date BETWEEN p_from AND p_to
   ORDER BY journey.cs_at DESC NULLS LAST
$function$;