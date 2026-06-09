CREATE OR REPLACE FUNCTION public.fn_search_deals_for_training(p_query text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_query    text := trim(p_query);
  v_is_email boolean;
  v_results  jsonb := '[]'::jsonb;
BEGIN
  IF v_query IS NULL OR length(v_query) = 0 THEN
    RETURN jsonb_build_object('found', false, 'results', '[]'::jsonb);
  END IF;

  v_is_email := position('@' in v_query) > 0;

  IF v_is_email THEN
    WITH leads AS (
      SELECT id, nome, email, telefone_normalized, empresa_nome, empresa_cnpj,
             piperun_id, pessoa_piperun_id, piperun_deals_history, updated_at
      FROM lia_attendances
      WHERE merged_into IS NULL
        AND lower(trim(v_query)) IN (
          lower(email),
          lower(empresa_email),
          lower(astron_email),
          lower(empresa_email_nf)
        )
      LIMIT 50
    ),
    deal_rows AS (
      SELECT
        l.id                                                              AS lead_id,
        d.piperun_deal_id::text                                           AS deal_id,
        l.piperun_id                                                      AS piperun_id,
        COALESCE(NULLIF(d.product,''), NULLIF(d.pipeline_name,''), l.nome) AS deal_title,
        l.nome                                                            AS person_name,
        l.empresa_nome                                                    AS company_name,
        l.empresa_cnpj                                                    AS company_cnpj,
        l.email                                                           AS email,
        l.telefone_normalized                                             AS telefone,
        d.status                                                          AS status,
        d.value                                                           AS value,
        d.closed_at                                                       AS closed_at,
        COALESCE(d.updated_at, l.updated_at)                              AS updated_at
      FROM leads l
      JOIN deals d ON d.lead_id = l.id AND d.is_deleted = false
      UNION ALL
      SELECT
        l.id, dh->>'deal_id', l.piperun_id,
        COALESCE(NULLIF(dh->>'deal_title',''), NULLIF(dh->>'title',''), NULLIF(dh->>'product',''), l.nome),
        l.nome, l.empresa_nome, l.empresa_cnpj, l.email, l.telefone_normalized,
        dh->>'status',
        NULLIF(dh->>'value','')::numeric,
        public.safe_to_timestamptz(dh->>'closed_at'),
        COALESCE(public.safe_to_timestamptz(dh->>'updated_at'), l.updated_at)
      FROM leads l,
        jsonb_array_elements(COALESCE(l.piperun_deals_history,'[]'::jsonb)) dh
      WHERE NOT EXISTS (
        SELECT 1 FROM deals d2
        WHERE d2.lead_id = l.id
          AND d2.piperun_deal_id::text = dh->>'deal_id'
          AND d2.is_deleted = false
      )
    )
    SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY (x.status='ganha') DESC, COALESCE(x.closed_at, x.updated_at) DESC), '[]'::jsonb)
    INTO v_results
    FROM (
      SELECT DISTINCT ON (deal_id)
        lead_id, deal_id, piperun_id, deal_title,
        person_name, company_name, company_cnpj, email, telefone,
        status, value, closed_at, updated_at,
        CASE
          WHEN company_name IS NOT NULL AND person_name IS NOT NULL THEN 'b2b2c'
          WHEN company_name IS NOT NULL THEN 'b2b'
          ELSE 'b2c'
        END AS deal_type
      FROM deal_rows
      WHERE deal_id IS NOT NULL
      ORDER BY deal_id, updated_at DESC
      LIMIT 50
    ) x;

  ELSE
    WITH leads AS (
      SELECT id, nome, email, telefone_normalized, empresa_nome, empresa_cnpj,
             piperun_id, pessoa_piperun_id, piperun_deals_history, updated_at
      FROM lia_attendances
      WHERE merged_into IS NULL AND piperun_id = v_query
      UNION
      SELECT la.id, la.nome, la.email, la.telefone_normalized, la.empresa_nome, la.empresa_cnpj,
             la.piperun_id, la.pessoa_piperun_id, la.piperun_deals_history, la.updated_at
      FROM lia_attendances la
      JOIN deals d ON d.lead_id = la.id
      WHERE la.merged_into IS NULL
        AND d.piperun_deal_id::text = v_query
        AND d.is_deleted = false
      UNION
      SELECT la.id, la.nome, la.email, la.telefone_normalized, la.empresa_nome, la.empresa_cnpj,
             la.piperun_id, la.pessoa_piperun_id, la.piperun_deals_history, la.updated_at
      FROM lia_attendances la,
        jsonb_array_elements(COALESCE(la.piperun_deals_history,'[]'::jsonb)) dh
      WHERE la.merged_into IS NULL
        AND dh->>'deal_id' = v_query
    ),
    deal_rows AS (
      SELECT
        l.id                                                              AS lead_id,
        d.piperun_deal_id::text                                           AS deal_id,
        l.piperun_id                                                      AS piperun_id,
        COALESCE(NULLIF(d.product,''), NULLIF(d.pipeline_name,''), l.nome) AS deal_title,
        l.nome                                                            AS person_name,
        l.empresa_nome                                                    AS company_name,
        l.empresa_cnpj                                                    AS company_cnpj,
        l.email                                                           AS email,
        l.telefone_normalized                                             AS telefone,
        d.status                                                          AS status,
        d.value                                                           AS value,
        d.closed_at                                                       AS closed_at,
        COALESCE(d.updated_at, l.updated_at)                              AS updated_at
      FROM leads l
      JOIN deals d ON d.lead_id = l.id AND d.is_deleted = false
      UNION ALL
      SELECT
        l.id, dh->>'deal_id', l.piperun_id,
        COALESCE(NULLIF(dh->>'deal_title',''), NULLIF(dh->>'title',''), NULLIF(dh->>'product',''), l.nome),
        l.nome, l.empresa_nome, l.empresa_cnpj, l.email, l.telefone_normalized,
        dh->>'status',
        NULLIF(dh->>'value','')::numeric,
        public.safe_to_timestamptz(dh->>'closed_at'),
        COALESCE(public.safe_to_timestamptz(dh->>'updated_at'), l.updated_at)
      FROM leads l,
        jsonb_array_elements(COALESCE(l.piperun_deals_history,'[]'::jsonb)) dh
      WHERE NOT EXISTS (
        SELECT 1 FROM deals d2
        WHERE d2.lead_id = l.id
          AND d2.piperun_deal_id::text = dh->>'deal_id'
          AND d2.is_deleted = false
      )
    )
    SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY (x.status='ganha') DESC, COALESCE(x.closed_at, x.updated_at) DESC), '[]'::jsonb)
    INTO v_results
    FROM (
      SELECT DISTINCT ON (deal_id)
        lead_id, deal_id, piperun_id, deal_title,
        person_name, company_name, company_cnpj, email, telefone,
        status, value, closed_at, updated_at,
        CASE
          WHEN company_name IS NOT NULL AND person_name IS NOT NULL THEN 'b2b2c'
          WHEN company_name IS NOT NULL THEN 'b2b'
          ELSE 'b2c'
        END AS deal_type
      FROM deal_rows
      WHERE deal_id IS NOT NULL
      ORDER BY deal_id, updated_at DESC
      LIMIT 50
    ) x;
  END IF;

  RETURN jsonb_build_object(
    'found', jsonb_array_length(COALESCE(v_results,'[]'::jsonb)) > 0,
    'is_email', v_is_email,
    'query', v_query,
    'results', COALESCE(v_results,'[]'::jsonb)
  );
END;
$function$;