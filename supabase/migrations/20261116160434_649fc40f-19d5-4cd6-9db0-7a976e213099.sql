REVOKE EXECUTE ON FUNCTION public.claim_pending_wa_messages(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_pending_wa_messages(integer) TO service_role;