REVOKE ALL ON FUNCTION public.backfill_activity_identity(integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.backfill_activity_identity(integer, integer) TO service_role;
REVOKE ALL ON FUNCTION public.resolve_lead_identity(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_lead_identity(uuid) TO authenticated, service_role;