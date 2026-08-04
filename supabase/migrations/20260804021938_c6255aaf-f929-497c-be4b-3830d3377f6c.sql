REVOKE ALL ON public.marketing_agent_api_log FROM anon;
REVOKE ALL ON public.marketing_agent_api_log FROM authenticated;
GRANT ALL ON public.marketing_agent_api_log TO service_role;
ALTER TABLE public.marketing_agent_api_log ENABLE ROW LEVEL SECURITY;