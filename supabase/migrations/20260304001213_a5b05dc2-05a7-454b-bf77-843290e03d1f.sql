
-- =============================================
-- PASSO 1: Novas tabelas
-- =============================================

CREATE TABLE lead_state_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES lia_attendances(id) ON DELETE CASCADE,
  old_stage text,
  new_stage text,
  intelligence_score jsonb,
  cognitive_stage text,
  owner_id text,
  source text NOT NULL DEFAULT 'system',
  is_regression boolean NOT NULL DEFAULT false,
  regression_gap_days integer,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_state_events_lead 
ON lead_state_events(lead_id, changed_at DESC);

CREATE TABLE intelligence_score_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version integer NOT NULL UNIQUE,
  weights jsonb NOT NULL,
  thresholds jsonb NOT NULL,
  is_active boolean DEFAULT false,
  created_at timestamptz DEFAULT NOW()
);

CREATE UNIQUE INDEX only_one_active_config
ON intelligence_score_config (is_active)
WHERE is_active = true;

CREATE TABLE backfill_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_number integer NOT NULL,
  processed_count integer DEFAULT 0,
  success_count integer DEFAULT 0,
  error_count integer DEFAULT 0,
  started_at timestamptz DEFAULT NOW(),
  finished_at timestamptz
);

-- =============================================
-- PASSO 2: Colunas em lia_attendances
-- =============================================

ALTER TABLE lia_attendances
  ADD COLUMN IF NOT EXISTS intelligence_score jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS intelligence_score_total integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS intelligence_score_updated_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS intelligence_score_backfilled_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS crm_lock_until timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS crm_lock_source text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS last_automated_action_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS automation_cooldown_until timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cognitive_model_version text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cognitive_prompt_hash text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cognitive_context_hash text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cognitive_analyzed_at timestamptz DEFAULT NULL;

-- =============================================
-- PASSO 3: Índices de performance
-- =============================================

CREATE INDEX idx_intelligence_score_total
ON lia_attendances(intelligence_score_total DESC NULLS LAST)
WHERE intelligence_score_total IS NOT NULL;

CREATE INDEX idx_crm_lock
ON lia_attendances(crm_lock_until)
WHERE crm_lock_until IS NOT NULL;

CREATE INDEX idx_automation_cooldown
ON lia_attendances(automation_cooldown_until)
WHERE automation_cooldown_until IS NOT NULL;

-- =============================================
-- PASSO 4: Config versão 1
-- =============================================

INSERT INTO intelligence_score_config (version, weights, thresholds, is_active)
VALUES (
  1,
  '{"sales_heat": 0.35, "technical_maturity": 0.20, "behavioral_engagement": 0.25, "purchase_power": 0.20}',
  '{"hot": 70, "warm": 40, "cold": 0}',
  true
);

-- =============================================
-- PASSO 5: RLS
-- =============================================

ALTER TABLE lead_state_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all" ON lead_state_events
FOR ALL USING (is_admin(auth.uid()));

CREATE POLICY "service_insert" ON lead_state_events
FOR INSERT WITH CHECK (true);

ALTER TABLE intelligence_score_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_config" ON intelligence_score_config
FOR ALL USING (is_admin(auth.uid()));

CREATE POLICY "service_read_config" ON intelligence_score_config
FOR SELECT USING (true);

ALTER TABLE backfill_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_backfill" ON backfill_log
FOR ALL USING (is_admin(auth.uid()));

CREATE POLICY "service_insert_backfill" ON backfill_log
FOR INSERT WITH CHECK (true);

-- =============================================
-- PASSO 6: 5 Views corrigidas para schema real
-- =============================================

CREATE OR REPLACE VIEW v_lead_commercial AS
SELECT
  id, telefone_normalized, email, nome,
  lead_stage_detected, intelligence_score_total,
  intelligence_score_updated_at,
  pessoa_piperun_id, empresa_piperun_id, piperun_id,
  proprietario_lead_crm,
  proposals_total_value,
  COALESCE(jsonb_array_length(CASE WHEN jsonb_typeof(proposals_data) = 'array' THEN proposals_data ELSE '[]'::jsonb END), 0) AS proposals_count,
  updated_at
FROM lia_attendances;

CREATE OR REPLACE VIEW v_lead_cognitive AS
SELECT
  id, telefone_normalized,
  lead_stage_detected,
  cognitive_analysis,
  intelligence_score,
  intelligence_score_total,
  cognitive_model_version,
  cognitive_prompt_hash,
  cognitive_analyzed_at,
  confidence_score_analysis
FROM lia_attendances;

CREATE OR REPLACE VIEW v_lead_academy AS
SELECT
  id, telefone_normalized,
  astron_status,
  astron_courses_total,
  astron_courses_completed,
  astron_last_login_at,
  CASE WHEN COALESCE(astron_courses_total, 0) > 0
    THEN ROUND(astron_courses_completed::numeric / astron_courses_total * 100, 1)
    ELSE 0
  END AS astron_completion_rate
FROM lia_attendances;

CREATE OR REPLACE VIEW v_lead_ecommerce AS
SELECT
  id, telefone_normalized,
  lojaintegrada_cliente_id,
  lojaintegrada_ultimo_pedido_valor,
  lojaintegrada_ultimo_pedido_data,
  lojaintegrada_ultimo_pedido_numero
FROM lia_attendances;

CREATE OR REPLACE VIEW lead_model_routing AS
SELECT
  id, telefone_normalized,
  intelligence_score_total,
  CASE
    WHEN intelligence_score_total IS NULL THEN 'gemini-flash-lite'
    WHEN intelligence_score_total < 40    THEN 'gemini-flash-lite'
    WHEN intelligence_score_total <= 70   THEN 'deepseek-chat'
    ELSE 'deepseek-reasoner'
  END AS recommended_model,
  CASE
    WHEN intelligence_score_total IS NULL THEN 400
    WHEN intelligence_score_total < 40    THEN 400
    WHEN intelligence_score_total <= 70   THEN 800
    ELSE 1500
  END AS max_tokens_cognitive
FROM lia_attendances
WHERE lead_status = 'ativo' OR lead_status = 'novo';

-- =============================================
-- PASSO 7: RPC calculate_lead_intelligence_score
-- =============================================

CREATE OR REPLACE FUNCTION calculate_lead_intelligence_score(p_lead_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead RECORD;
  v_config RECORD;
  v_weights jsonb;
  v_urgency_score numeric := 0;
  v_timeline_score numeric := 0;
  v_recency_bonus numeric := 0;
  v_sales_heat numeric := 0;
  v_tech_score numeric := 0;
  v_tech_confidence text := 'high';
  v_tech_null_count integer := 0;
  v_messages_score numeric := 0;
  v_sessions_score numeric := 0;
  v_confidence_score numeric := 0;
  v_behavioral_engagement numeric := 0;
  v_proposals_score numeric := 0;
  v_ecommerce_score numeric := 0;
  v_academy_score numeric := 0;
  v_purchase_power numeric := 0;
  v_score_total numeric := 0;
  v_score_jsonb jsonb;
BEGIN
  -- Load lead
  SELECT * INTO v_lead FROM lia_attendances WHERE id = p_lead_id;
  IF NOT FOUND THEN RETURN; END IF;

  -- Guard: no recalc within 60s
  IF v_lead.intelligence_score_updated_at IS NOT NULL 
     AND v_lead.intelligence_score_updated_at > NOW() - INTERVAL '60 seconds' THEN
    RETURN;
  END IF;

  -- Load active config
  SELECT * INTO v_config FROM intelligence_score_config WHERE is_active = true LIMIT 1;
  IF NOT FOUND THEN RETURN; END IF;
  v_weights := v_config.weights;

  -- EIXO 1: sales_heat (0.35)
  v_urgency_score := CASE v_lead.urgency_level
    WHEN 'alta'  THEN 90
    WHEN 'media' THEN 50
    WHEN 'baixa' THEN 20
    ELSE 30
  END;

  v_timeline_score := CASE v_lead.interest_timeline
    WHEN 'imediato'    THEN 100
    WHEN '3_6_meses'   THEN 60
    WHEN '6_12_meses'  THEN 30
    WHEN 'indefinido'  THEN 10
    ELSE 20
  END;

  v_recency_bonus := CASE
    WHEN v_lead.ultima_sessao_at > NOW() - INTERVAL '3 days'  THEN 15
    WHEN v_lead.ultima_sessao_at > NOW() - INTERVAL '7 days'  THEN 8
    WHEN v_lead.ultima_sessao_at > NOW() - INTERVAL '15 days' THEN 3
    ELSE 0
  END;

  v_sales_heat := LEAST(100, (v_urgency_score * 0.45) + (v_timeline_score * 0.40) + v_recency_bonus);

  -- EIXO 2: technical_maturity (0.20) — tem_impressora/tem_scanner are TEXT
  v_tech_null_count := (
    CASE WHEN v_lead.tem_impressora IS NULL OR v_lead.tem_impressora = '' THEN 1 ELSE 0 END +
    CASE WHEN v_lead.tem_scanner IS NULL OR v_lead.tem_scanner = '' THEN 1 ELSE 0 END +
    CASE WHEN v_lead.software_cad IS NULL OR v_lead.software_cad = '' THEN 1 ELSE 0 END +
    CASE WHEN v_lead.volume_mensal_pecas IS NULL OR v_lead.volume_mensal_pecas = '' THEN 1 ELSE 0 END
  );

  IF v_tech_null_count = 4 THEN
    v_tech_score := 50;
    v_tech_confidence := 'low';
  ELSE
    v_tech_score :=
      CASE WHEN v_lead.tem_impressora IS NOT NULL AND v_lead.tem_impressora != '' THEN 25 ELSE 0 END +
      CASE WHEN v_lead.tem_scanner IS NOT NULL AND v_lead.tem_scanner != '' THEN 25 ELSE 0 END +
      CASE WHEN v_lead.software_cad IS NOT NULL AND v_lead.software_cad != '' THEN 25 ELSE 0 END +
      CASE WHEN v_lead.volume_mensal_pecas IS NOT NULL AND v_lead.volume_mensal_pecas != '' THEN 25 ELSE 0 END;
    v_tech_confidence := CASE WHEN v_tech_null_count >= 2 THEN 'medium' ELSE 'high' END;
  END IF;

  -- EIXO 3: behavioral_engagement (0.25)
  v_messages_score := LEAST(100,
    CASE WHEN COALESCE(v_lead.total_messages, 0) > 0
    THEN (LN(v_lead.total_messages) / LN(100)) * 100
    ELSE 0 END
  );

  v_sessions_score := LEAST(100,
    CASE WHEN COALESCE(v_lead.total_sessions, 0) > 0
    THEN (v_lead.total_sessions::numeric / 20) * 100
    ELSE 0 END
  );

  v_confidence_score := COALESCE(v_lead.confidence_score_analysis, 0);

  v_behavioral_engagement := (v_messages_score * 0.35) + (v_sessions_score * 0.35) + (v_confidence_score * 0.30);

  -- EIXO 4: purchase_power (0.20)
  v_proposals_score := LEAST(100,
    CASE WHEN COALESCE(v_lead.proposals_total_value, 0) > 0
    THEN (LN(v_lead.proposals_total_value) / LN(100000)) * 100
    ELSE 0 END
  );

  v_ecommerce_score := LEAST(100,
    CASE WHEN COALESCE(v_lead.lojaintegrada_ultimo_pedido_valor, 0) > 0
    THEN (LN(v_lead.lojaintegrada_ultimo_pedido_valor) / LN(10000)) * 100
    ELSE 0 END
  );

  v_academy_score := CASE WHEN COALESCE(v_lead.astron_courses_total, 0) > 0 THEN 40 ELSE 0 END;

  v_purchase_power := (v_proposals_score * 0.50) + (v_ecommerce_score * 0.30) + (v_academy_score * 0.20);

  -- SCORE TOTAL
  v_score_total := ROUND(
    (v_sales_heat            * (v_weights->>'sales_heat')::numeric) +
    (v_tech_score            * (v_weights->>'technical_maturity')::numeric) +
    (v_behavioral_engagement * (v_weights->>'behavioral_engagement')::numeric) +
    (v_purchase_power        * (v_weights->>'purchase_power')::numeric)
  );

  -- JSONB versionado
  v_score_jsonb := jsonb_build_object(
    'version', v_config.version,
    'calculated_at', NOW(),
    'axes', jsonb_build_object(
      'sales_heat', jsonb_build_object('value', ROUND(v_sales_heat), 'weight', (v_weights->>'sales_heat')::numeric, 'confidence', 'high'),
      'technical_maturity', jsonb_build_object('value', ROUND(v_tech_score), 'weight', (v_weights->>'technical_maturity')::numeric, 'confidence', v_tech_confidence),
      'behavioral_engagement', jsonb_build_object('value', ROUND(v_behavioral_engagement), 'weight', (v_weights->>'behavioral_engagement')::numeric, 'confidence', 'high'),
      'purchase_power', jsonb_build_object('value', ROUND(v_purchase_power), 'weight', (v_weights->>'purchase_power')::numeric, 'confidence', 'high')
    ),
    'score_total', v_score_total
  );

  -- Persist
  UPDATE lia_attendances SET
    intelligence_score = v_score_jsonb,
    intelligence_score_total = v_score_total,
    intelligence_score_updated_at = NOW()
  WHERE id = p_lead_id;
END;
$$;
