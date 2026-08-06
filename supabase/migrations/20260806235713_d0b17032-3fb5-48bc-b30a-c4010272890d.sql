CREATE OR REPLACE FUNCTION public.fn_campaign_revenue(p_from date, p_to date)
RETURNS TABLE(platform_campaign_id text, revenue numeric, won_deals bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT la.platform_campaign_id::text,
         COALESCE(SUM(COALESCE(d.value, d.value_products, 0)), 0)::numeric AS revenue,
         COUNT(*)::bigint AS won_deals
  FROM public.deals d
  JOIN public.lia_attendances la ON la.id = d.lead_id
  WHERE la.merged_into IS NULL
    AND la.platform_campaign_id IS NOT NULL
    AND d.status = 'ganha'
    AND COALESCE(d.closed_at, d.piperun_updated_at, d.updated_at, d.created_at)::date BETWEEN p_from AND p_to
  GROUP BY 1
$$;

GRANT EXECUTE ON FUNCTION public.fn_campaign_revenue(date, date) TO authenticated, service_role;