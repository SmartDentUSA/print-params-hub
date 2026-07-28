REVOKE EXECUTE ON FUNCTION public.resolve_lead_identity(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.resolve_lead_identity(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.resolve_lead_identity(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_lead_identity(uuid) TO service_role;