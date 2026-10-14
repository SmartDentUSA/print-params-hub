CREATE OR REPLACE FUNCTION public.fn_kol_next_contract_number()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_seq bigint;
BEGIN
  SELECT nextval('public.kol_contract_number_seq') INTO v_seq;
  RETURN 'KOL-' || to_char(now(), 'YYYY') || '-' || lpad(v_seq::text, 4, '0');
END $$;
REVOKE ALL ON FUNCTION public.fn_kol_next_contract_number() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_kol_next_contract_number() TO service_role;