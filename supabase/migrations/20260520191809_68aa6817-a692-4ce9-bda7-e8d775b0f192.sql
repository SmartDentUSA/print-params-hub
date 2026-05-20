-- 1. Add turma_number column
ALTER TABLE smartops_course_turmas
  ADD COLUMN IF NOT EXISTS turma_number int;

CREATE INDEX IF NOT EXISTS idx_turmas_number_modality
  ON smartops_course_turmas (turma_number);

-- 2. Counters table per modality
CREATE TABLE IF NOT EXISTS smartops_turma_counters (
  modality text PRIMARY KEY,
  last_number int NOT NULL DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE smartops_turma_counters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_counters" ON smartops_turma_counters;
CREATE POLICY "service_role_all_counters" ON smartops_turma_counters
  FOR ALL USING (true) WITH CHECK (true);

-- 3. Seeds: next presencial = 140 → last_number = 139; online/online_ao_vivo start at 0
INSERT INTO smartops_turma_counters (modality, last_number) VALUES
  ('presencial', 139),
  ('online', 0),
  ('online_ao_vivo', 0)
ON CONFLICT (modality) DO NOTHING;

-- 4. Trigger function
CREATE OR REPLACE FUNCTION public.fn_assign_turma_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_modality text;
  v_next int;
BEGIN
  IF NEW.turma_number IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT modality INTO v_modality FROM smartops_courses WHERE id = NEW.course_id;
  IF v_modality IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE smartops_turma_counters
     SET last_number = last_number + 1,
         updated_at = now()
   WHERE modality = v_modality
  RETURNING last_number INTO v_next;

  IF v_next IS NULL THEN
    INSERT INTO smartops_turma_counters (modality, last_number)
    VALUES (v_modality, 1)
    RETURNING last_number INTO v_next;
  END IF;

  NEW.turma_number := v_next;
  RETURN NEW;
END;
$$;

-- 5. Trigger
DROP TRIGGER IF EXISTS trg_assign_turma_number ON smartops_course_turmas;
CREATE TRIGGER trg_assign_turma_number
BEFORE INSERT ON smartops_course_turmas
FOR EACH ROW EXECUTE FUNCTION public.fn_assign_turma_number();