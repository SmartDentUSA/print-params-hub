CREATE POLICY "Admins insert campaign_sessions"
ON public.campaign_sessions FOR INSERT TO authenticated
WITH CHECK (public.is_admin((SELECT auth.uid())));

CREATE POLICY "Admins update campaign_sessions"
ON public.campaign_sessions FOR UPDATE TO authenticated
USING (public.is_admin((SELECT auth.uid())))
WITH CHECK (public.is_admin((SELECT auth.uid())));