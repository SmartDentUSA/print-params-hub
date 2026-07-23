
CREATE OR REPLACE FUNCTION public.match_li_customer_to_lead(_li_id bigint)
RETURNS uuid
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_lead UUID;
  v_email TEXT;
  v_cpf TEXT;
  v_cnpj TEXT;
  v_tel_cel TEXT;
  v_tel_prin TEXT;
BEGIN
  SELECT lower(nullif(email,'')),
         nullif(regexp_replace(coalesce(cpf,''),'[^0-9]','','g'),''),
         nullif(regexp_replace(coalesce(cnpj,''),'[^0-9]','','g'),''),
         nullif(regexp_replace(coalesce(telefone_celular,''),'[^0-9]','','g'),''),
         nullif(regexp_replace(coalesce(telefone_principal,''),'[^0-9]','','g'),'')
    INTO v_email, v_cpf, v_cnpj, v_tel_cel, v_tel_prin
  FROM public.loja_integrada_clientes_import
  WHERE id = _li_id;

  IF v_email IS NOT NULL THEN
    SELECT id INTO v_lead FROM public.lia_attendances
    WHERE merged_into IS NULL AND lower(email) = v_email
    ORDER BY created_at ASC LIMIT 1;
    IF v_lead IS NOT NULL THEN RETURN v_lead; END IF;
  END IF;

  IF v_cpf IS NOT NULL THEN
    SELECT id INTO v_lead FROM public.lia_attendances
    WHERE merged_into IS NULL
      AND regexp_replace(coalesce(pessoa_cpf,''),'[^0-9]','','g') = v_cpf
    ORDER BY created_at ASC LIMIT 1;
    IF v_lead IS NOT NULL THEN RETURN v_lead; END IF;
  END IF;

  IF v_cnpj IS NOT NULL THEN
    SELECT id INTO v_lead FROM public.lia_attendances
    WHERE merged_into IS NULL
      AND regexp_replace(coalesce(empresa_cnpj,''),'[^0-9]','','g') = v_cnpj
    ORDER BY created_at ASC LIMIT 1;
    IF v_lead IS NOT NULL THEN RETURN v_lead; END IF;
  END IF;

  IF v_tel_cel IS NOT NULL THEN
    SELECT id INTO v_lead FROM public.lia_attendances
    WHERE merged_into IS NULL
      AND (
        regexp_replace(coalesce(telefone_normalized,''),'[^0-9]','','g') = v_tel_cel
        OR regexp_replace(coalesce(wa_phone,''),'[^0-9]','','g') = v_tel_cel
        OR regexp_replace(coalesce(telefone_raw,''),'[^0-9]','','g') = v_tel_cel
      )
    ORDER BY created_at ASC LIMIT 1;
    IF v_lead IS NOT NULL THEN RETURN v_lead; END IF;
  END IF;

  IF v_tel_prin IS NOT NULL THEN
    SELECT id INTO v_lead FROM public.lia_attendances
    WHERE merged_into IS NULL
      AND (
        regexp_replace(coalesce(telefone_normalized,''),'[^0-9]','','g') = v_tel_prin
        OR regexp_replace(coalesce(wa_phone,''),'[^0-9]','','g') = v_tel_prin
        OR regexp_replace(coalesce(telefone_raw,''),'[^0-9]','','g') = v_tel_prin
      )
    ORDER BY created_at ASC LIMIT 1;
  END IF;

  RETURN v_lead;
END;
$function$;
