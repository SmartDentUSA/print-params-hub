
CREATE OR REPLACE FUNCTION public.fn_search_deals_by_status(
  p_status text DEFAULT NULL,
  p_product text DEFAULT NULL,
  p_owner text DEFAULT NULL,
  p_min_value numeric DEFAULT NULL,
  p_max_value numeric DEFAULT NULL,
  p_limit integer DEFAULT 50
)
RETURNS TABLE(
  lead_id uuid,
  lead_nome text,
  lead_email text,
  deal_id text,
  deal_status text,
  deal_value numeric,
  deal_owner text,
  deal_stage text,
  deal_origin text,
  deal_created_at text,
  deal_items text
)
LANGUAGE sql
STABLE
AS $function$
  SELECT
    la.id AS lead_id,
    la.nome AS lead_nome,
    la.email AS lead_email,
    (deal->>'deal_id')::text AS deal_id,
    COALESCE(deal->>'status', 'unknown') AS deal_status,
    COALESCE((deal->>'value')::numeric, (deal->>'value_total')::numeric, 0) AS deal_value,
    COALESCE(deal->>'owner_name', deal->>'vendedor') AS deal_owner,
    COALESCE(deal->>'stage_name', deal->>'etapa') AS deal_stage,
    COALESCE(deal->>'origin_name', deal->>'origem') AS deal_origin,
    COALESCE(deal->>'piperun_created_at', deal->>'created_at', deal->>'data') AS deal_created_at,
    (
      SELECT string_agg(
        COALESCE(item->>'nome', item->>'name', item->>'product_name', '?'),
        ' | '
      )
      FROM jsonb_array_elements(
        CASE WHEN deal ? 'proposals' AND jsonb_typeof(deal->'proposals') = 'array'
          THEN (
            SELECT COALESCE(jsonb_agg(pi), '[]'::jsonb)
            FROM jsonb_array_elements(deal->'proposals') prop,
                 jsonb_array_elements(
                   CASE WHEN prop ? 'items' AND jsonb_typeof(prop->'items') = 'array'
                     THEN prop->'items' ELSE '[]'::jsonb END
                 ) pi
          )
          ELSE '[]'::jsonb
        END
      ) item
    ) AS deal_items
  FROM public.lia_attendances la,
    jsonb_array_elements(la.piperun_deals_history) deal
  WHERE la.piperun_deals_history IS NOT NULL
    AND jsonb_typeof(la.piperun_deals_history) = 'array'
    AND jsonb_array_length(la.piperun_deals_history) > 0
    AND la.merged_into IS NULL
    AND (p_status IS NULL OR (deal->>'status') ILIKE '%' || p_status || '%')
    AND (p_product IS NULL OR deal::text ILIKE '%' || p_product || '%')
    AND (p_owner IS NULL OR COALESCE(deal->>'owner_name', deal->>'vendedor', '') ILIKE '%' || p_owner || '%')
    AND (p_min_value IS NULL OR COALESCE((deal->>'value')::numeric, (deal->>'value_total')::numeric, 0) >= p_min_value)
    AND (p_max_value IS NULL OR COALESCE((deal->>'value')::numeric, (deal->>'value_total')::numeric, 0) <= p_max_value)
  ORDER BY COALESCE(deal->>'piperun_created_at', deal->>'created_at', deal->>'data') DESC NULLS LAST
  LIMIT p_limit;
$function$;
