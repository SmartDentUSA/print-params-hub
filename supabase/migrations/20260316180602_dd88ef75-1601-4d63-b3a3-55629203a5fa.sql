
-- Function 1: Search leads by product name in piperun_deals_history JSONB
CREATE OR REPLACE FUNCTION public.fn_search_leads_by_proposal_product(
  product_search TEXT,
  deal_status TEXT DEFAULT NULL
)
RETURNS TABLE(lead_id uuid) AS $$
  SELECT DISTINCT la.id AS lead_id
  FROM public.lia_attendances la,
    jsonb_array_elements(la.piperun_deals_history) deal,
    jsonb_array_elements(CASE WHEN deal ? 'proposals' AND jsonb_typeof(deal->'proposals') = 'array' THEN deal->'proposals' ELSE '[]'::jsonb END) prop,
    jsonb_array_elements(CASE WHEN prop ? 'items' AND jsonb_typeof(prop->'items') = 'array' THEN prop->'items' ELSE '[]'::jsonb END) item
  WHERE la.piperun_deals_history IS NOT NULL
    AND jsonb_typeof(la.piperun_deals_history) = 'array'
    AND jsonb_array_length(la.piperun_deals_history) > 0
    AND (item->>'nome' ILIKE '%' || product_search || '%'
         OR item->>'name' ILIKE '%' || product_search || '%'
         OR item->>'product_name' ILIKE '%' || product_search || '%')
    AND (deal_status IS NULL OR deal->>'status' ILIKE '%' || deal_status || '%')
$$ LANGUAGE sql STABLE;

-- Function 2: List unique product names from all proposals for autocomplete
CREATE OR REPLACE FUNCTION public.fn_list_proposal_products()
RETURNS TABLE(product_name TEXT, occurrences BIGINT) AS $$
  SELECT 
    COALESCE(item->>'nome', item->>'name', item->>'product_name') AS product_name,
    COUNT(*) AS occurrences
  FROM public.lia_attendances la,
    jsonb_array_elements(la.piperun_deals_history) deal,
    jsonb_array_elements(CASE WHEN deal ? 'proposals' AND jsonb_typeof(deal->'proposals') = 'array' THEN deal->'proposals' ELSE '[]'::jsonb END) prop,
    jsonb_array_elements(CASE WHEN prop ? 'items' AND jsonb_typeof(prop->'items') = 'array' THEN prop->'items' ELSE '[]'::jsonb END) item
  WHERE la.piperun_deals_history IS NOT NULL
    AND jsonb_typeof(la.piperun_deals_history) = 'array'
    AND jsonb_array_length(la.piperun_deals_history) > 0
    AND COALESCE(item->>'nome', item->>'name', item->>'product_name') IS NOT NULL
  GROUP BY product_name
  ORDER BY occurrences DESC
  LIMIT 200;
$$ LANGUAGE sql STABLE;
