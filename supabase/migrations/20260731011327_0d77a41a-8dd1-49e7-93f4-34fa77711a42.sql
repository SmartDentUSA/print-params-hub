ALTER TABLE public._check_leads_0710 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public._check_leads_0710 FROM anon;
GRANT SELECT ON public._check_leads_0710 TO authenticated;
GRANT ALL ON public._check_leads_0710 TO service_role;
DROP POLICY IF EXISTS check_leads_0710_admin_read ON public._check_leads_0710;
CREATE POLICY check_leads_0710_admin_read ON public._check_leads_0710 FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS auth_read_oauth_tokens ON public.google_oauth_tokens;
CREATE POLICY admin_read_oauth_tokens ON public.google_oauth_tokens FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS companies_mirror_read_authenticated ON public.piperun_companies_mirror;
CREATE POLICY companies_mirror_read_admin ON public.piperun_companies_mirror FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS persons_mirror_read_authenticated ON public.piperun_persons_mirror;
CREATE POLICY persons_mirror_read_admin ON public.piperun_persons_mirror FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS authenticated_read_stripe_webhook_events ON public.stripe_webhook_events;
CREATE POLICY admin_read_stripe_webhook_events ON public.stripe_webhook_events FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));