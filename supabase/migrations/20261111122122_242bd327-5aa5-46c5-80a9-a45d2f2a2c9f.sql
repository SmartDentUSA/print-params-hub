REVOKE EXECUTE ON FUNCTION public.fn_can_use_copilot(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.fn_can_use_copilot(uuid) TO service_role;