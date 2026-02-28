-- Drop old CHECK constraint and recreate with PQL_recompra
ALTER TABLE public.lia_attendances DROP CONSTRAINT check_lead_stage;

ALTER TABLE public.lia_attendances ADD CONSTRAINT check_lead_stage 
  CHECK (
    lead_stage_detected IS NULL 
    OR lead_stage_detected = ANY (ARRAY[
      'MQL_pesquisador'::text, 
      'PQL_recompra'::text,
      'SAL_comparador'::text, 
      'SQL_decisor'::text, 
      'CLIENTE_ativo'::text
    ])
  );