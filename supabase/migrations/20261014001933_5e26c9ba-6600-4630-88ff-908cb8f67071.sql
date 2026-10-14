ALTER FUNCTION public.fn_kol_default_commission_rows(date) SECURITY INVOKER;
REVOKE EXECUTE ON FUNCTION public.fn_kol_default_commission_rows(date) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.fn_trg_lia_kol_zdefaults() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_trg_lia_kol_commission_guard() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_kol_commission_audit() FROM public, anon, authenticated;