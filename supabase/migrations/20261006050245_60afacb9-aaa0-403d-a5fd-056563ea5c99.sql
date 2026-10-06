ALTER FUNCTION public.fn_deal_won_at(timestamptz, timestamptz) SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.fn_campaign_conversions(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.fn_campaign_conversions(uuid) TO authenticated, service_role;