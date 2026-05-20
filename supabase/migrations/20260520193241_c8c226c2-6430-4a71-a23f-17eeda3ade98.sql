
UPDATE smartops_course_turmas
SET turma_number = turma_number - 1
WHERE turma_number IS NOT NULL
  AND course_id IN (SELECT id FROM smartops_courses WHERE modality = 'presencial');

UPDATE smartops_turma_counters
SET last_number = COALESCE((
  SELECT MAX(t.turma_number)
  FROM smartops_course_turmas t
  JOIN smartops_courses c ON c.id = t.course_id
  WHERE c.modality = 'presencial'
), 0),
updated_at = now()
WHERE modality = 'presencial';
