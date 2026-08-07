CREATE OR REPLACE FUNCTION public.fn_campaign_revenue(p_from date, p_to date)
RETURNS TABLE(
  platform_campaign_id text,
  revenue numeric,
  won_deals bigint,
  won_leads bigint,
  leads_converted bigint,
  avg_lead_time_days numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
WITH exact_events AS (
  SELECT
    l.lead_id,
    COALESCE(
      NULLIF(l.event_data #>> '{lead,campaignId}', ''),
      NULLIF(l.event_data ->> 'platform_campaign_id', ''),
      NULLIF(l.event_data ->> 'campaign_id', '')
    ) AS cid,
    l.event_timestamp AS converted_at
  FROM public.lead_activity_log l
  JOIN public.lia_attendances la
    ON la.id = l.lead_id
   AND la.merged_into IS NULL
  WHERE l.event_type IN ('zernio_lead_raw', 'meta_ads_lead_entry')
),
exact_conversions AS (
  SELECT lead_id, cid, MAX(converted_at) AS converted_at
  FROM exact_events
  WHERE cid IS NOT NULL
  GROUP BY lead_id, cid
),
fallback_conversions AS (
  SELECT
    la.id AS lead_id,
    la.platform_campaign_id::text AS cid,
    COALESCE(la.entrada_sistema, la.created_at) AS converted_at
  FROM public.lia_attendances la
  WHERE la.merged_into IS NULL
    AND la.platform_campaign_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM exact_conversions e
      WHERE e.lead_id = la.id
    )
),
conversions AS (
  SELECT * FROM exact_conversions
  UNION ALL
  SELECT * FROM fallback_conversions
),
period_conversions AS (
  SELECT *
  FROM conversions
  WHERE converted_at::date BETWEEN p_from AND p_to
),
won_candidates AS (
  SELECT
    d.id AS deal_id,
    d.piperun_deal_id,
    d.lead_id,
    COALESCE(d.value, d.value_products, 0)::numeric AS deal_value,
    d.closed_at,
    COALESCE(d.piperun_created_at, d.created_at) AS stored_created_at,
    d.pipeline_name,
    c.cid,
    c.converted_at,
    ROW_NUMBER() OVER (
      PARTITION BY d.id
      ORDER BY c.converted_at DESC, c.cid
    ) AS attribution_rank
  FROM public.deals d
  JOIN period_conversions c
    ON c.lead_id = d.lead_id
   AND c.converted_at <= d.closed_at
  WHERE d.status = 'ganha'
    AND d.closed_at IS NOT NULL
    AND COALESCE(d.is_deleted, false) = false
),
attributed_won AS (
  SELECT *
  FROM won_candidates
  WHERE attribution_rank = 1
),
journeys AS (
  SELECT
    w.*,
    COALESCE(
      (
        SELECT MIN(t.transitioned_at)
        FROM public.piperun_stage_transitions t
        WHERE t.lead_id = w.lead_id
          AND t.deal_id = w.piperun_deal_id::text
          AND t.pipeline_name ILIKE '%vendas%'
      ),
      w.stored_created_at
    ) AS deal_created_at,
    COALESCE(
      (
        SELECT MIN(t.transitioned_at)
        FROM public.piperun_stage_transitions t
        WHERE t.lead_id = w.lead_id
          AND t.deal_id = w.piperun_deal_id::text
          AND (t.pipeline_name ILIKE '%cs%' OR t.pipeline_name ILIKE '%onboarding%')
      ),
      CASE
        WHEN w.pipeline_name ILIKE '%cs%' OR w.pipeline_name ILIKE '%onboarding%'
        THEN w.closed_at
      END
    ) AS cs_at
  FROM attributed_won w
),
campaigns AS (
  SELECT DISTINCT cid
  FROM period_conversions
)
SELECT
  c.cid AS platform_campaign_id,
  COALESCE(SUM(j.deal_value), 0)::numeric AS revenue,
  COUNT(j.deal_id)::bigint AS won_deals,
  COUNT(DISTINCT j.lead_id)::bigint AS won_leads,
  (
    SELECT COUNT(DISTINCT pc.lead_id)
    FROM period_conversions pc
    WHERE pc.cid = c.cid
  )::bigint AS leads_converted,
  ROUND(
    AVG(
      CASE
        WHEN j.cs_at IS NOT NULL
         AND j.deal_created_at IS NOT NULL
         AND j.cs_at >= j.deal_created_at
        THEN EXTRACT(EPOCH FROM (j.cs_at - j.deal_created_at)) / 86400
      END
    )::numeric,
    1
  ) AS avg_lead_time_days
FROM campaigns c
LEFT JOIN journeys j ON j.cid = c.cid
GROUP BY c.cid;
$function$;

CREATE OR REPLACE FUNCTION public.fn_campaign_revenue_detail(
  p_campaign_id text,
  p_from date,
  p_to date
)
RETURNS TABLE(
  lead_id uuid,
  lead_name text,
  deal_id uuid,
  piperun_deal_id text,
  deal_title text,
  pipeline_name text,
  deal_value numeric,
  converted_at timestamp with time zone,
  closed_at timestamp with time zone,
  vendas_at timestamp with time zone,
  cs_at timestamp with time zone,
  lead_time_days numeric,
  campaign_product text,
  purchased_products text[],
  cross_sell boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
WITH exact_events AS (
  SELECT
    l.lead_id,
    COALESCE(
      NULLIF(l.event_data #>> '{lead,campaignId}', ''),
      NULLIF(l.event_data ->> 'platform_campaign_id', ''),
      NULLIF(l.event_data ->> 'campaign_id', '')
    ) AS cid,
    l.event_timestamp AS converted_at
  FROM public.lead_activity_log l
  JOIN public.lia_attendances la
    ON la.id = l.lead_id
   AND la.merged_into IS NULL
  WHERE l.event_type IN ('zernio_lead_raw', 'meta_ads_lead_entry')
),
exact_conversions AS (
  SELECT lead_id, cid, MAX(converted_at) AS converted_at
  FROM exact_events
  WHERE cid IS NOT NULL
  GROUP BY lead_id, cid
),
fallback_conversions AS (
  SELECT
    la.id AS lead_id,
    la.platform_campaign_id::text AS cid,
    COALESCE(la.entrada_sistema, la.created_at) AS converted_at
  FROM public.lia_attendances la
  WHERE la.merged_into IS NULL
    AND la.platform_campaign_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM exact_conversions e WHERE e.lead_id = la.id
    )
),
conversions AS (
  SELECT * FROM exact_conversions
  UNION ALL
  SELECT * FROM fallback_conversions
),
period_conversions AS (
  SELECT *
  FROM conversions
  WHERE converted_at::date BETWEEN p_from AND p_to
),
won_candidates AS (
  SELECT
    d.*,
    c.cid,
    c.converted_at,
    ROW_NUMBER() OVER (
      PARTITION BY d.id
      ORDER BY c.converted_at DESC, c.cid
    ) AS attribution_rank
  FROM public.deals d
  JOIN period_conversions c
    ON c.lead_id = d.lead_id
   AND c.converted_at <= d.closed_at
  WHERE d.status = 'ganha'
    AND d.closed_at IS NOT NULL
    AND COALESCE(d.is_deleted, false) = false
),
attributed AS (
  SELECT *
  FROM won_candidates
  WHERE attribution_rank = 1
    AND cid = p_campaign_id
)
SELECT
  a.lead_id,
  la.nome AS lead_name,
  a.id AS deal_id,
  a.piperun_deal_id,
  a.deal_title,
  a.pipeline_name,
  COALESCE(a.value, a.value_products, 0)::numeric AS deal_value,
  a.converted_at,
  a.closed_at,
  journey.deal_created_at AS vendas_at,
  journey.cs_at,
  CASE
    WHEN journey.cs_at IS NOT NULL
     AND journey.deal_created_at IS NOT NULL
     AND journey.cs_at >= journey.deal_created_at
    THEN ROUND((EXTRACT(EPOCH FROM (journey.cs_at - journey.deal_created_at)) / 86400)::numeric, 1)
  END AS lead_time_days,
  la.produto_interesse AS campaign_product,
  COALESCE(items.names, ARRAY[]::text[]) AS purchased_products,
  CASE
    WHEN la.produto_interesse IS NULL OR items.names IS NULL THEN NULL
    ELSE NOT EXISTS (
      SELECT 1
      FROM unnest(items.names) n
      WHERE lower(n) LIKE '%' || lower(split_part(la.produto_interesse, ' ', 1)) || '%'
    )
  END AS cross_sell
FROM attributed a
JOIN public.lia_attendances la ON la.id = a.lead_id
LEFT JOIN LATERAL (
  SELECT
    COALESCE(
      (
        SELECT MIN(t.transitioned_at)
        FROM public.piperun_stage_transitions t
        WHERE t.lead_id = a.lead_id
          AND t.deal_id = a.piperun_deal_id::text
          AND t.pipeline_name ILIKE '%vendas%'
      ),
      COALESCE(a.piperun_created_at, a.created_at)
    ) AS deal_created_at,
    COALESCE(
      (
        SELECT MIN(t.transitioned_at)
        FROM public.piperun_stage_transitions t
        WHERE t.lead_id = a.lead_id
          AND t.deal_id = a.piperun_deal_id::text
          AND (t.pipeline_name ILIKE '%cs%' OR t.pipeline_name ILIKE '%onboarding%')
      ),
      CASE
        WHEN a.pipeline_name ILIKE '%cs%' OR a.pipeline_name ILIKE '%onboarding%'
        THEN a.closed_at
      END
    ) AS cs_at
) journey ON true
LEFT JOIN LATERAL (
  SELECT array_agg(DISTINCT COALESCE(di.product_name, di.nome_produto)) AS names
  FROM public.deal_items di
  WHERE di.deal_id = a.piperun_deal_id
    AND COALESCE(di.product_name, di.nome_produto) IS NOT NULL
) items ON true
ORDER BY journey.cs_at DESC NULLS LAST;
$function$;