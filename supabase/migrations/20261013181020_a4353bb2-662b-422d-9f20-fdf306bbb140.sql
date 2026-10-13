REVOKE EXECUTE ON FUNCTION public.fn_kol_phone_pending() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_kol_phone_pending() TO authenticated;
CREATE POLICY "Somente servidor" ON public.kol_portal_attempts FOR ALL TO service_role USING (true) WITH CHECK (true);