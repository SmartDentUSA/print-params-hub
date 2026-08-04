CREATE OR REPLACE FUNCTION public.painel_comercial_refresh_all(p_mes date DEFAULT (date_trunc('month'::text, now()))::date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  PERFORM public.painel_comercial_refresh(p_mes);
  -- sobrescreve o bloco de vendedores com a versão corrigida (Max(CRM, Omie))
  PERFORM public.painel_vendedores_refresh(p_mes);
END
$fn$;

SELECT cron.alter_job(162, command => 'SELECT public.painel_comercial_refresh_all();');