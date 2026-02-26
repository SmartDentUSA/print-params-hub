
ALTER TABLE lia_attendances
  ADD COLUMN IF NOT EXISTS cognitive_analysis jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cognitive_updated_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS lead_stage_detected text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS interest_timeline text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS urgency_level text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS psychological_profile text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS primary_motivation text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS objection_risk text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS recommended_approach text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS confidence_score_analysis integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS prediction_accuracy numeric DEFAULT NULL;

ALTER TABLE lia_attendances
  ADD CONSTRAINT check_lead_stage CHECK (lead_stage_detected IS NULL OR lead_stage_detected IN ('MQL_pesquisador','SAL_comparador','SQL_decisor','CLIENTE_ativo'));

ALTER TABLE lia_attendances
  ADD CONSTRAINT check_urgency_level CHECK (urgency_level IS NULL OR urgency_level IN ('alta','media','baixa'));

ALTER TABLE lia_attendances
  ADD CONSTRAINT check_interest_timeline CHECK (interest_timeline IS NULL OR interest_timeline IN ('imediato','3_6_meses','6_12_meses','indefinido'));

CREATE INDEX IF NOT EXISTS idx_lia_lead_stage ON lia_attendances(lead_stage_detected);
CREATE INDEX IF NOT EXISTS idx_lia_urgency ON lia_attendances(urgency_level);
CREATE INDEX IF NOT EXISTS idx_lia_cognitive_updated ON lia_attendances(cognitive_updated_at);
