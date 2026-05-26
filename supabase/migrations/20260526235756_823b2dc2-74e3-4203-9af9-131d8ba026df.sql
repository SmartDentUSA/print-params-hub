
CREATE OR REPLACE FUNCTION public.compute_lead_portfolio_from_mappings(p_lead_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_lead   RECORD;
  v_result jsonb := '{}'::jsonb;
  v_summary jsonb;
  r RECORD;
BEGIN
  SELECT * INTO v_lead FROM lia_attendances WHERE id = p_lead_id;
  IF NOT FOUND THEN RETURN '{}'::jsonb; END IF;

  -- ── 1. ATIVO: deals ganhas × workflow_cell_mappings (product) ──
  FOR r IN (
    WITH won_items AS (
      SELECT lower(trim(coalesce(di.product_name, di.nome_produto, ''))) AS pname
      FROM deal_items di
      JOIN deals d ON d.piperun_deal_id::text = di.deal_id
      WHERE di.lead_id = p_lead_id
        AND d.status = 'ganha'
        AND coalesce(di.product_name, di.nome_produto, '') <> ''
    ),
    matched AS (
      SELECT m.workflow_stage, m.workflow_cell, m.mapped_label, COUNT(*) AS hits
      FROM won_items w
      JOIN workflow_cell_mappings m
        ON m.mapping_type = 'product'
       AND (
         w.pname = lower(m.mapped_label)
         OR w.pname = lower(m.mapped_value)
         OR w.pname LIKE '%' || lower(m.mapped_label) || '%'
         OR w.pname LIKE '%' || lower(m.mapped_value) || '%'
       )
      GROUP BY m.workflow_stage, m.workflow_cell, m.mapped_label
    ),
    ranked AS (
      SELECT workflow_stage, workflow_cell, mapped_label, hits,
             ROW_NUMBER() OVER (PARTITION BY workflow_stage, workflow_cell ORDER BY hits DESC) AS rn,
             SUM(hits) OVER (PARTITION BY workflow_stage, workflow_cell) AS total_hits
      FROM matched
    )
    SELECT workflow_stage, workflow_cell, mapped_label, total_hits
    FROM ranked WHERE rn = 1
  ) LOOP
    v_result := jsonb_set(
      v_result, ARRAY[r.workflow_stage, r.workflow_cell],
      jsonb_build_object('label', r.mapped_label, 'layer', 'ativo', 'hits', r.total_hits), true);
  END LOOP;

  -- ── 2. CONCORRENTE: equip_* × workflow_cell_mappings (competitor) ──
  FOR r IN (
    WITH equip_vals(field_value) AS (
      VALUES
        (NULLIF(trim(v_lead.equip_scanner), '')),
        (NULLIF(trim(v_lead.equip_impressora), '')),
        (NULLIF(trim(v_lead.equip_pos_impressao), '')),
        (NULLIF(trim(v_lead.equip_fresadora), '')),
        (NULLIF(trim(v_lead.equip_cad), '')),
        (NULLIF(trim(v_lead.software_cad), ''))
    )
    SELECT DISTINCT ON (m.workflow_stage, m.workflow_cell)
      m.workflow_stage, m.workflow_cell, m.mapped_label
    FROM equip_vals e
    JOIN workflow_cell_mappings m
      ON m.mapping_type = 'competitor'
     AND e.field_value IS NOT NULL
     AND (
       lower(e.field_value) = lower(m.mapped_label)
       OR lower(e.field_value) = lower(m.mapped_value)
       OR lower(e.field_value) LIKE '%' || lower(m.mapped_label) || '%'
       OR lower(e.field_value) LIKE '%' || lower(m.mapped_value) || '%'
     )
  ) LOOP
    IF v_result #> ARRAY[r.workflow_stage, r.workflow_cell] IS NULL THEN
      v_result := jsonb_set(
        v_result, ARRAY[r.workflow_stage, r.workflow_cell],
        jsonb_build_object('label', r.mapped_label, 'layer', 'conc', 'hits', 1), true);
    END IF;
  END LOOP;

  -- ── 3. SDR: sdr_*_interesse × workflow_cell_mappings (sdr_field) ──
  FOR r IN (
    WITH sdr_pairs(stage_hint, field_value) AS (
      VALUES
        ('etapa_1_scanner',       NULLIF(trim(v_lead.sdr_scanner_interesse), '')),
        ('etapa_2_cad',           NULLIF(trim(v_lead.sdr_cad_interesse), '')),
        ('etapa_3_impressao',     NULLIF(trim(v_lead.sdr_impressora_interesse), '')),
        ('etapa_3_impressao',     NULLIF(trim(v_lead.resina_interesse), '')),
        ('etapa_4_pos_impressao', NULLIF(trim(v_lead.sdr_pos_impressao_interesse), '')),
        ('etapa_5_finalizacao',   NULLIF(trim(v_lead.sdr_caracterizacao_interesse), '')),
        ('etapa_5_finalizacao',   NULLIF(trim(v_lead.sdr_dentistica_interesse), '')),
        ('etapa_6_cursos',        NULLIF(trim(v_lead.sdr_cursos_interesse), '')),
        ('etapa_7_fresagem',      NULLIF(trim(v_lead.sdr_fresagem_interesse), ''))
    )
    SELECT DISTINCT ON (m.workflow_stage, m.workflow_cell)
      m.workflow_stage, m.workflow_cell, m.mapped_label, s.field_value
    FROM sdr_pairs s
    JOIN workflow_cell_mappings m
      ON m.mapping_type = 'sdr_field'
     AND m.workflow_stage = s.stage_hint
     AND s.field_value IS NOT NULL
     AND lower(s.field_value) NOT IN ('nao','não','no','false','0','nao_tem')
     AND (
       lower(s.field_value) = lower(m.mapped_label)
       OR lower(s.field_value) = lower(m.mapped_value)
       OR lower(s.field_value) LIKE '%' || lower(m.mapped_label) || '%'
       OR lower(s.field_value) LIKE '%' || lower(m.mapped_value) || '%'
       OR lower(s.field_value) IN ('sim','yes','true','1','interesse','interessado')
     )
  ) LOOP
    IF v_result #> ARRAY[r.workflow_stage, r.workflow_cell] IS NULL THEN
      v_result := jsonb_set(
        v_result, ARRAY[r.workflow_stage, r.workflow_cell],
        jsonb_build_object('label', coalesce(r.mapped_label, r.field_value), 'layer', 'sdr', 'hits', 1), true);
    END IF;
  END LOOP;

  -- ── 4. Summary ──
  SELECT jsonb_build_object(
    'n_ativo', COALESCE(SUM(((cell->>'layer') = 'ativo')::int), 0),
    'n_conc',  COALESCE(SUM(((cell->>'layer') = 'conc')::int),  0),
    'n_sdr',   COALESCE(SUM(((cell->>'layer') = 'sdr')::int),   0),
    'n_mapeamento', 0
  ) INTO v_summary
  FROM jsonb_each(v_result) AS stages(stage_key, stage_val),
       jsonb_each(stage_val) AS cells(cell_key, cell);

  v_result := v_result || jsonb_build_object('summary', COALESCE(v_summary, jsonb_build_object('n_ativo',0,'n_conc',0,'n_sdr',0,'n_mapeamento',0)));

  RETURN v_result;
END;
$$;
