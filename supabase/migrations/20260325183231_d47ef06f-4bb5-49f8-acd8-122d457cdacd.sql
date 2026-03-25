
-- Function: fn_sync_normalized_from_lead
-- Upserts companies, people, deals from lia_attendances data
-- Classifies buyer_type as B2B or B2C

CREATE OR REPLACE FUNCTION public.fn_sync_normalized_from_lead(p_lead_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_lead RECORD;
  v_company_id uuid;
  v_person_id uuid;
  v_deal RECORD;
  v_deal_element jsonb;
  v_deal_id text;
  v_proposals jsonb;
BEGIN
  -- Fetch the lead
  SELECT * INTO v_lead
  FROM lia_attendances
  WHERE id = p_lead_id;

  IF NOT FOUND THEN RETURN; END IF;

  -- ─── 1. Upsert Company ───
  IF v_lead.empresa_piperun_id IS NOT NULL THEN
    INSERT INTO companies (
      piperun_company_id, nome, razao_social, cnpj, ie, cnae,
      cidade, uf, segmento, porte, website, facebook, linkedin,
      situacao, touch_model, type, is_active, updated_at
    ) VALUES (
      v_lead.empresa_piperun_id::int,
      COALESCE(v_lead.empresa_nome, 'Empresa #' || v_lead.empresa_piperun_id),
      v_lead.empresa_razao_social,
      v_lead.empresa_cnpj,
      v_lead.empresa_ie,
      v_lead.empresa_cnae,
      v_lead.empresa_cidade,
      v_lead.empresa_uf,
      v_lead.empresa_segmento,
      v_lead.empresa_porte,
      v_lead.empresa_website,
      v_lead.empresa_facebook,
      v_lead.empresa_linkedin,
      v_lead.empresa_situacao,
      v_lead.empresa_touch_model,
      'company',
      true,
      NOW()
    )
    ON CONFLICT (piperun_company_id) DO UPDATE SET
      nome = COALESCE(EXCLUDED.nome, companies.nome),
      razao_social = COALESCE(EXCLUDED.razao_social, companies.razao_social),
      cnpj = COALESCE(EXCLUDED.cnpj, companies.cnpj),
      ie = COALESCE(EXCLUDED.ie, companies.ie),
      cnae = COALESCE(EXCLUDED.cnae, companies.cnae),
      cidade = COALESCE(EXCLUDED.cidade, companies.cidade),
      uf = COALESCE(EXCLUDED.uf, companies.uf),
      segmento = COALESCE(EXCLUDED.segmento, companies.segmento),
      porte = COALESCE(EXCLUDED.porte, companies.porte),
      website = COALESCE(EXCLUDED.website, companies.website),
      facebook = COALESCE(EXCLUDED.facebook, companies.facebook),
      linkedin = COALESCE(EXCLUDED.linkedin, companies.linkedin),
      situacao = COALESCE(EXCLUDED.situacao, companies.situacao),
      touch_model = COALESCE(EXCLUDED.touch_model, companies.touch_model),
      updated_at = NOW();

    SELECT id INTO v_company_id
    FROM companies
    WHERE piperun_company_id = v_lead.empresa_piperun_id::int;
  END IF;

  -- ─── 2. Upsert Person ───
  IF v_lead.pessoa_piperun_id IS NOT NULL THEN
    INSERT INTO people (
      piperun_person_id, email, telefone_normalized, nome,
      cpf, cargo, genero, nascimento, primary_company_id, updated_at
    ) VALUES (
      v_lead.pessoa_piperun_id::int,
      v_lead.email,
      v_lead.telefone_normalized,
      COALESCE(v_lead.nome, 'Pessoa #' || v_lead.pessoa_piperun_id),
      v_lead.pessoa_cpf,
      v_lead.pessoa_cargo,
      v_lead.pessoa_genero,
      v_lead.pessoa_nascimento::date,
      v_company_id,
      NOW()
    )
    ON CONFLICT (piperun_person_id) DO UPDATE SET
      email = COALESCE(EXCLUDED.email, people.email),
      telefone_normalized = COALESCE(EXCLUDED.telefone_normalized, people.telefone_normalized),
      nome = COALESCE(EXCLUDED.nome, people.nome),
      cpf = COALESCE(EXCLUDED.cpf, people.cpf),
      cargo = COALESCE(EXCLUDED.cargo, people.cargo),
      genero = COALESCE(EXCLUDED.genero, people.genero),
      nascimento = COALESCE(EXCLUDED.nascimento, people.nascimento),
      primary_company_id = COALESCE(EXCLUDED.primary_company_id, people.primary_company_id),
      updated_at = NOW();

    SELECT id INTO v_person_id
    FROM people
    WHERE piperun_person_id = v_lead.pessoa_piperun_id::int;
  END IF;

  -- ─── 3. Update lead FK references + buyer_type ───
  UPDATE lia_attendances SET
    person_id = COALESCE(v_person_id, person_id),
    company_id = COALESCE(v_company_id, company_id),
    buyer_type = CASE
      WHEN v_company_id IS NOT NULL THEN 'B2B'
      WHEN v_lead.empresa_piperun_id IS NOT NULL THEN 'B2B'
      ELSE 'B2C'
    END
  WHERE id = p_lead_id;

  -- ─── 4. Upsert Deals from history ───
  IF v_lead.piperun_deals_history IS NOT NULL
     AND jsonb_typeof(v_lead.piperun_deals_history) = 'array'
     AND jsonb_array_length(v_lead.piperun_deals_history) > 0
  THEN
    FOR v_deal_element IN SELECT * FROM jsonb_array_elements(v_lead.piperun_deals_history)
    LOOP
      v_deal_id := v_deal_element->>'deal_id';
      IF v_deal_id IS NULL OR v_deal_id = '' THEN CONTINUE; END IF;

      v_proposals := CASE
        WHEN v_deal_element ? 'proposals' AND jsonb_typeof(v_deal_element->'proposals') = 'array'
        THEN v_deal_element->'proposals'
        ELSE NULL
      END;

      INSERT INTO deals (
        piperun_deal_id, deal_hash, person_id, company_id, lead_id,
        pipeline_id, pipeline_name, stage_name, status,
        value, value_products, value_freight,
        owner_name, origin_name, product, proposals,
        piperun_created_at, closed_at,
        deal_source, updated_at
      ) VALUES (
        v_deal_id,
        v_deal_element->>'deal_hash',
        v_person_id,
        v_company_id,
        p_lead_id,
        (v_deal_element->>'pipeline_id')::int,
        v_deal_element->>'pipeline_name',
        v_deal_element->>'stage_name',
        COALESCE(v_deal_element->>'status', 'aberta'),
        (v_deal_element->>'value')::numeric,
        (v_deal_element->>'value_products')::numeric,
        (v_deal_element->>'value_freight')::numeric,
        v_deal_element->>'owner_name',
        v_deal_element->>'origin_name',
        v_deal_element->>'product',
        v_proposals,
        CASE WHEN v_deal_element->>'created_at' IS NOT NULL
          THEN (v_deal_element->>'created_at')::timestamptz ELSE NULL END,
        CASE WHEN v_deal_element->>'closed_at' IS NOT NULL
          THEN (v_deal_element->>'closed_at')::timestamptz ELSE NULL END,
        'piperun',
        NOW()
      )
      ON CONFLICT (piperun_deal_id) DO UPDATE SET
        deal_hash = COALESCE(EXCLUDED.deal_hash, deals.deal_hash),
        person_id = COALESCE(EXCLUDED.person_id, deals.person_id),
        company_id = COALESCE(EXCLUDED.company_id, deals.company_id),
        lead_id = COALESCE(EXCLUDED.lead_id, deals.lead_id),
        pipeline_id = COALESCE(EXCLUDED.pipeline_id, deals.pipeline_id),
        pipeline_name = COALESCE(EXCLUDED.pipeline_name, deals.pipeline_name),
        stage_name = COALESCE(EXCLUDED.stage_name, deals.stage_name),
        status = COALESCE(EXCLUDED.status, deals.status),
        value = COALESCE(EXCLUDED.value, deals.value),
        value_products = COALESCE(EXCLUDED.value_products, deals.value_products),
        value_freight = COALESCE(EXCLUDED.value_freight, deals.value_freight),
        owner_name = COALESCE(EXCLUDED.owner_name, deals.owner_name),
        origin_name = COALESCE(EXCLUDED.origin_name, deals.origin_name),
        product = COALESCE(EXCLUDED.product, deals.product),
        proposals = COALESCE(EXCLUDED.proposals, deals.proposals),
        piperun_created_at = COALESCE(EXCLUDED.piperun_created_at, deals.piperun_created_at),
        closed_at = COALESCE(EXCLUDED.closed_at, deals.closed_at),
        updated_at = NOW();
    END LOOP;
  END IF;

END;
$function$;
