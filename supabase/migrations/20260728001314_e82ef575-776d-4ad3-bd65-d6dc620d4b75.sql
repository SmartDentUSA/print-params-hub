-- Gate -1: contain execute_agent_sql
REVOKE EXECUTE ON FUNCTION public.execute_agent_sql(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.execute_agent_sql(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.execute_agent_sql(text) FROM authenticated;
ALTER FUNCTION public.execute_agent_sql(text) SET search_path = public;