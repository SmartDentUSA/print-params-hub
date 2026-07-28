CREATE OR REPLACE FUNCTION public.resolve_lead_identity(p_lead_id uuid)
RETURNS TABLE(person_id uuid, company_id uuid)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_lead   record;
  v_person uuid;
  v_company uuid;
  v_cnpj   text;
BEGIN
  IF p_lead_id IS NULL THEN RETURN; END IF;

  SELECT l.id, l.email, l.telefone_normalized, l.pessoa_piperun_id, l.empresa_piperun_id, l.empresa_cnpj
    INTO v_lead
  FROM public.lia_attendances l
  WHERE l.id = COALESCE(
    (SELECT x.merged_into FROM public.lia_attendances x WHERE x.id = p_lead_id),
    p_lead_id
  );

  IF v_lead.id IS NULL THEN RETURN; END IF;

  IF v_lead.pessoa_piperun_id IS NOT NULL THEN
    SELECT p.id, p.primary_company_id INTO v_person, v_company
    FROM public.people p
    WHERE p.piperun_person_id = v_lead.pessoa_piperun_id LIMIT 1;
  END IF;

  IF v_person IS NULL AND NULLIF(btrim(COALESCE(v_lead.email, '')), '') IS NOT NULL THEN
    SELECT p.id, p.primary_company_id INTO v_person, v_company
    FROM public.people p
    WHERE lower(p.email) = lower(btrim(v_lead.email)) LIMIT 1;
  END IF;

  IF v_person IS NULL AND NULLIF(btrim(COALESCE(v_lead.telefone_normalized, '')), '') IS NOT NULL THEN
    SELECT p.id, p.primary_company_id INTO v_person, v_company
    FROM public.people p
    WHERE p.telefone_normalized = v_lead.telefone_normalized LIMIT 1;
  END IF;

  IF v_lead.empresa_piperun_id IS NOT NULL THEN
    SELECT c.id INTO v_company
    FROM public.companies c
    WHERE c.piperun_company_id = v_lead.empresa_piperun_id LIMIT 1;
  END IF;

  IF v_company IS NULL THEN
    v_cnpj := NULLIF(regexp_replace(COALESCE(v_lead.empresa_cnpj, ''), '\D', '', 'g'), '');
    IF v_cnpj IS NOT NULL THEN
      SELECT c.id INTO v_company
      FROM public.companies c
      WHERE regexp_replace(COALESCE(c.cnpj, ''), '\D', '', 'g') = v_cnpj LIMIT 1;
    END IF;
  END IF;

  person_id := v_person;
  company_id := v_company;
  RETURN NEXT;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.resolve_lead_identity(uuid) FROM anon;