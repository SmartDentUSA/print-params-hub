DROP POLICY IF EXISTS "Sales team reads lead dossiers" ON public.lead_ai_dossiers;
REVOKE ALL ON public.lead_ai_dossiers FROM authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.fn_can_use_lead_dossier(uuid) FROM authenticated;