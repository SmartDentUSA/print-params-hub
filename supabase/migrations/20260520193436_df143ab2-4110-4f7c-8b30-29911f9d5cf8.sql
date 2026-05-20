
-- Wipe all current numbers
UPDATE smartops_course_turmas t
SET turma_number = NULL
WHERE course_id IN (SELECT id FROM smartops_courses WHERE modality='presencial');

-- Renumber only ACTIVE presencial turmas, chronologically, starting at 137
WITH ordered AS (
  SELECT v.id, ROW_NUMBER() OVER (ORDER BY v.start_date NULLS LAST, v.id) + 136 AS n
  FROM v_turmas_com_vagas v
  WHERE v.modality = 'presencial' AND v.active = true
)
UPDATE smartops_course_turmas t
SET turma_number = o.n
FROM ordered o
WHERE t.id = o.id;

-- Sync counter to max
UPDATE smartops_turma_counters
SET last_number = COALESCE((
  SELECT MAX(t.turma_number)
  FROM smartops_course_turmas t
  JOIN smartops_courses c ON c.id = t.course_id
  WHERE c.modality='presencial'
), 137),
updated_at = now()
WHERE modality='presencial';
