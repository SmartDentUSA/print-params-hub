-- Payload completo do PipeRun no espelho public.deals
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS deal_title text,
  ADD COLUMN IF NOT EXISTS origin_group text,
  ADD COLUMN IF NOT EXISTS probability numeric,
  ADD COLUMN IF NOT EXISTS forecast_close_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_contact_at timestamptz,
  ADD COLUMN IF NOT EXISTS tags text[],
  ADD COLUMN IF NOT EXISTS notes_text text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS custom_fields jsonb,
  ADD COLUMN IF NOT EXISTS piperun_updated_at timestamptz;

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
  v_deal_element jsonb;
  v_deal_id text;
  v_proposals jsonb;
  v_origin text;
  v_tags text[];
BEGIN
  SELECT * INTO v_lead FROM lia_attendances WHERE id = p_lead_id;
  IF NOT FOUND THEN RETURN; END IF;

  IF v_lead.empresa_piperun_id IS NOT NULL THEN
    INSERT INTO companies (
      piperun_company_id, nome, razao_social, cnpj, ie, cnae,
      cidade, uf, segmento, porte, website, facebook, linkedin,
      situacao, touch_model, type, is_active, updated_at
    ) VALUES (
      v_lead.empresa_piperun_id::int,
      COALESCE(v_lead.empresa_nome, 'Empresa #' || v_lead.empresa_piperun_id),
      v_lead.empresa_razao_social, v_lead.empresa_cnpj, v_lead.empresa_ie, v_lead.empresa_cnae,
      v_lead.empresa_cidade, v_lead.empresa_uf, v_lead.empresa_segmento, v_lead.empresa_porte,
      v_lead.empresa_website, v_lead.empresa_facebook, v_lead.empresa_linkedin,
      v_lead.empresa_situacao, v_lead.empresa_touch_model, 'company', true, NOW()
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

    SELECT id INTO v_company_id FROM companies WHERE piperun_company_id = v_lead.empresa_piperun_id::int;
  END IF;

  IF v_lead.pessoa_piperun_id IS NOT NULL THEN
    INSERT INTO people (
      piperun_person_id, email, telefone_normalized, nome,
      cpf, cargo, genero, nascimento, primary_company_id, updated_at
    ) VALUES (
      v_lead.pessoa_piperun_id::int,
      v_lead.email, v_lead.telefone_normalized,
      COALESCE(v_lead.nome, 'Pessoa #' || v_lead.pessoa_piperun_id),
      v_lead.pessoa_cpf, v_lead.pessoa_cargo, v_lead.pessoa_genero,
      public.fn_safe_date(v_lead.pessoa_nascimento::text), v_company_id, NOW()
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

    SELECT id INTO v_person_id FROM people WHERE piperun_person_id = v_lead.pessoa_piperun_id::int;
  END IF;

  UPDATE lia_attendances SET
    person_id = COALESCE(v_person_id, person_id),
    company_id = COALESCE(v_company_id, company_id)
  WHERE id = p_lead_id;

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
        THEN v_deal_element->'proposals' ELSE NULL END;

      -- origem: o snapshot grava `origem`; aceitar também `origin_name`
      v_origin := NULLIF(COALESCE(v_deal_element->>'origin_name', v_deal_element->>'origem'), '');

      v_tags := CASE
        WHEN jsonb_typeof(v_deal_element->'tags') = 'array'
        THEN ARRAY(SELECT jsonb_array_elements_text(v_deal_element->'tags'))
        ELSE NULL END;

      INSERT INTO deals (
        piperun_deal_id, deal_hash, deal_title, person_id, company_id, lead_id,
        pipeline_id, pipeline_name, stage_id, stage_name, started_in_stage_id, status,
        value, value_products, value_freight,
        freight_type, payment_method, payment_installments, currency, billing_entity,
        owner_name, origin_name, piperun_origin_id, piperun_origin_name, origin_group,
        temperature, probability, loss_reason, loss_comment,
        product, proposals, items_text, tags, notes_text, description, custom_fields,
        piperun_created_at, closed_at, last_stage_updated_at, forecast_close_at,
        last_contact_at, piperun_updated_at, deal_source, updated_at
      ) VALUES (
        v_deal_id, v_deal_element->>'deal_hash', NULLIF(v_deal_element->>'deal_title',''),
        v_person_id, v_company_id, p_lead_id,
        NULLIF(regexp_replace(COALESCE(v_deal_element->>'pipeline_id',''), '\D', '', 'g'), '')::int,
        v_deal_element->>'pipeline_name',
        NULLIF(regexp_replace(COALESCE(v_deal_element->>'stage_id',''), '\D', '', 'g'), '')::int,
        v_deal_element->>'stage_name',
        NULLIF(regexp_replace(COALESCE(v_deal_element->>'started_in_stage_id',''), '\D', '', 'g'), '')::int,
        COALESCE(v_deal_element->>'status', 'aberta'),
        NULLIF(regexp_replace(COALESCE(v_deal_element->>'value',''), '[^0-9.\-]', '', 'g'), '')::numeric,
        NULLIF(regexp_replace(COALESCE(v_deal_element->>'value_products',''), '[^0-9.\-]', '', 'g'), '')::numeric,
        NULLIF(regexp_replace(COALESCE(v_deal_element->>'value_freight',''), '[^0-9.\-]', '', 'g'), '')::numeric,
        NULLIF(v_deal_element->>'freight_type',''),
        NULLIF(v_deal_element->>'payment_method',''),
        NULLIF(regexp_replace(COALESCE(v_deal_element->>'payment_installments',''), '\D', '', 'g'), '')::int,
        NULLIF(v_deal_element->>'currency',''),
        NULLIF(v_deal_element->>'billing_entity',''),
        v_deal_element->>'owner_name', v_origin,
        NULLIF(regexp_replace(COALESCE(v_deal_element->>'origin_id',''), '\D', '', 'g'), '')::int,
        v_origin,
        NULLIF(v_deal_element->>'origin_group',''),
        NULLIF(v_deal_element->>'temperature',''),
        NULLIF(regexp_replace(COALESCE(v_deal_element->>'probability',''), '[^0-9.\-]', '', 'g'), '')::numeric,
        NULLIF(v_deal_element->>'loss_reason',''),
        NULLIF(v_deal_element->>'loss_comment',''),
        v_deal_element->>'product', v_proposals,
        NULLIF(v_deal_element->>'items_text',''),
        v_tags,
        NULLIF(v_deal_element->>'notes_text',''),
        NULLIF(v_deal_element->>'description',''),
        CASE WHEN jsonb_typeof(v_deal_element->'custom_fields') = 'object'
             AND v_deal_element->'custom_fields' <> '{}'::jsonb
             THEN v_deal_element->'custom_fields' ELSE NULL END,
        public.fn_safe_timestamptz(v_deal_element->>'created_at'),
        public.fn_safe_timestamptz(v_deal_element->>'closed_at'),
        public.fn_safe_timestamptz(v_deal_element->>'last_stage_updated_at'),
        public.fn_safe_timestamptz(v_deal_element->>'forecast_close_at'),
        public.fn_safe_timestamptz(v_deal_element->>'last_contact_at'),
        public.fn_safe_timestamptz(v_deal_element->>'updated_at'),
        'piperun', NOW()
      )
      ON CONFLICT (piperun_deal_id) DO UPDATE SET
        deal_hash = COALESCE(EXCLUDED.deal_hash, deals.deal_hash),
        deal_title = COALESCE(EXCLUDED.deal_title, deals.deal_title),
        person_id = COALESCE(EXCLUDED.person_id, deals.person_id),
        company_id = COALESCE(EXCLUDED.company_id, deals.company_id),
        lead_id = COALESCE(EXCLUDED.lead_id, deals.lead_id),
        pipeline_id = COALESCE(EXCLUDED.pipeline_id, deals.pipeline_id),
        pipeline_name = COALESCE(EXCLUDED.pipeline_name, deals.pipeline_name),
        stage_id = COALESCE(EXCLUDED.stage_id, deals.stage_id),
        stage_name = COALESCE(EXCLUDED.stage_name, deals.stage_name),
        started_in_stage_id = COALESCE(EXCLUDED.started_in_stage_id, deals.started_in_stage_id),
        status = COALESCE(EXCLUDED.status, deals.status),
        value = COALESCE(EXCLUDED.value, deals.value),
        value_products = COALESCE(EXCLUDED.value_products, deals.value_products),
        value_freight = COALESCE(EXCLUDED.value_freight, deals.value_freight),
        freight_type = COALESCE(EXCLUDED.freight_type, deals.freight_type),
        payment_method = COALESCE(EXCLUDED.payment_method, deals.payment_method),
        payment_installments = COALESCE(EXCLUDED.payment_installments, deals.payment_installments),
        currency = COALESCE(EXCLUDED.currency, deals.currency),
        billing_entity = COALESCE(EXCLUDED.billing_entity, deals.billing_entity),
        owner_name = COALESCE(EXCLUDED.owner_name, deals.owner_name),
        origin_name = COALESCE(EXCLUDED.origin_name, deals.origin_name),
        piperun_origin_id = COALESCE(EXCLUDED.piperun_origin_id, deals.piperun_origin_id),
        piperun_origin_name = COALESCE(EXCLUDED.piperun_origin_name, deals.piperun_origin_name),
        origin_group = COALESCE(EXCLUDED.origin_group, deals.origin_group),
        temperature = COALESCE(EXCLUDED.temperature, deals.temperature),
        probability = COALESCE(EXCLUDED.probability, deals.probability),
        loss_reason = COALESCE(EXCLUDED.loss_reason, deals.loss_reason),
        loss_comment = COALESCE(EXCLUDED.loss_comment, deals.loss_comment),
        product = COALESCE(EXCLUDED.product, deals.product),
        proposals = COALESCE(EXCLUDED.proposals, deals.proposals),
        items_text = COALESCE(EXCLUDED.items_text, deals.items_text),
        tags = COALESCE(EXCLUDED.tags, deals.tags),
        notes_text = COALESCE(EXCLUDED.notes_text, deals.notes_text),
        description = COALESCE(EXCLUDED.description, deals.description),
        custom_fields = COALESCE(EXCLUDED.custom_fields, deals.custom_fields),
        piperun_created_at = COALESCE(EXCLUDED.piperun_created_at, deals.piperun_created_at),
        closed_at = COALESCE(EXCLUDED.closed_at, deals.closed_at),
        last_stage_updated_at = COALESCE(EXCLUDED.last_stage_updated_at, deals.last_stage_updated_at),
        forecast_close_at = COALESCE(EXCLUDED.forecast_close_at, deals.forecast_close_at),
        last_contact_at = COALESCE(EXCLUDED.last_contact_at, deals.last_contact_at),
        piperun_updated_at = COALESCE(EXCLUDED.piperun_updated_at, deals.piperun_updated_at),
        updated_at = NOW();
    END LOOP;
  END IF;
END;
$function$;