CREATE OR REPLACE FUNCTION public.resolve_lead_identity(p_lead_id uuid)
RETURNS TABLE(person_id uuid, company_id uuid)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_lead        record;
  v_person      uuid;
  v_person_co   uuid;
  v_company     uuid;
  v_cnpj        text;
  v_id          uuid := p_lead_id;
  v_next        uuid;
  v_hops        int := 0;
BEGIN
  IF p_lead_id IS NULL THEN RETURN; END IF;

  -- CDP Integrity: seguir a cadeia de merge até o lead canônico (multi-hop, máx 10)
  LOOP
    SELECT x.merged_into INTO v_next FROM public.lia_attendances x WHERE x.id = v_id;
    EXIT WHEN v_next IS NULL OR v_next = v_id OR v_hops >= 10;
    v_id := v_next;
    v_hops := v_hops + 1;
  END LOOP;

  SELECT l.id, l.email, l.telefone_normalized, l.pessoa_piperun_id, l.empresa_piperun_id, l.empresa_cnpj
    INTO v_lead
  FROM public.lia_attendances l
  WHERE l.id = v_id;

  IF v_lead.id IS NULL THEN RETURN; END IF;

  -- ── Pessoa: piperun_person_id → telefone → e-mail (determinístico: mais antigo) ──
  IF v_lead.pessoa_piperun_id IS NOT NULL THEN
    SELECT p.id, p.primary_company_id INTO v_person, v_person_co
    FROM public.people p
    WHERE p.piperun_person_id = v_lead.pessoa_piperun_id
    ORDER BY p.created_at ASC NULLS LAST, p.id ASC
    LIMIT 1;
  END IF;

  IF v_person IS NULL AND NULLIF(btrim(COALESCE(v_lead.telefone_normalized, '')), '') IS NOT NULL THEN
    SELECT p.id, p.primary_company_id INTO v_person, v_person_co
    FROM public.people p
    WHERE p.telefone_normalized = v_lead.telefone_normalized
    ORDER BY p.created_at ASC NULLS LAST, p.id ASC
    LIMIT 1;
  END IF;

  IF v_person IS NULL AND NULLIF(btrim(COALESCE(v_lead.email, '')), '') IS NOT NULL THEN
    SELECT p.id, p.primary_company_id INTO v_person, v_person_co
    FROM public.people p
    WHERE lower(p.email) = lower(btrim(v_lead.email))
    ORDER BY p.created_at ASC NULLS LAST, p.id ASC
    LIMIT 1;
  END IF;

  -- ── Empresa: piperun_company_id → cnpj → empresa primária da pessoa ──
  IF v_lead.empresa_piperun_id IS NOT NULL THEN
    SELECT c.id INTO v_company
    FROM public.companies c
    WHERE c.piperun_company_id = v_lead.empresa_piperun_id
    ORDER BY c.created_at ASC NULLS LAST, c.id ASC
    LIMIT 1;
  END IF;

  IF v_company IS NULL THEN
    v_cnpj := NULLIF(regexp_replace(COALESCE(v_lead.empresa_cnpj, ''), '\D', '', 'g'), '');
    IF v_cnpj IS NOT NULL THEN
      SELECT c.id INTO v_company
      FROM public.companies c
      WHERE regexp_replace(COALESCE(c.cnpj, ''), '\D', '', 'g') = v_cnpj
      ORDER BY c.created_at ASC NULLS LAST, c.id ASC
      LIMIT 1;
    END IF;
  END IF;

  IF v_company IS NULL THEN
    v_company := v_person_co;
  END IF;

  -- Empresa mesclada → canônica
  IF v_company IS NOT NULL THEN
    SELECT COALESCE(c.merged_into, c.id) INTO v_company FROM public.companies c WHERE c.id = v_company;
  END IF;

  person_id := v_person;
  company_id := v_company;
  RETURN NEXT;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.resolve_lead_identity(uuid) FROM anon;