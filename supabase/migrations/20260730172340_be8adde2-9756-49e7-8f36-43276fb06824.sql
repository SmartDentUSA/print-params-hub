REVOKE ALL ON public.zernio_leadgen_dedup FROM anon;
REVOKE ALL ON public.zernio_leadgen_dedup FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON public.zernio_leadgen_dedup TO service_role;