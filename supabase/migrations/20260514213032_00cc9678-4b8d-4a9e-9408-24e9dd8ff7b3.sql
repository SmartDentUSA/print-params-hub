CREATE OR REPLACE FUNCTION public.fn_get_deal_from_history(p_lead_id uuid, p_deal_id text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT dh
  FROM lia_attendances la,
    LATERAL jsonb_array_elements(la.piperun_deals_history) AS dh
  WHERE la.id = p_lead_id
    AND la.merged_into IS NULL
    AND dh->>'deal_id' = p_deal_id
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.fn_get_deal_from_history(uuid, text) TO authenticated, anon, service_role;