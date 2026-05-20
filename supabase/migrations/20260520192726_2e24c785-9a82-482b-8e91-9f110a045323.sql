
WITH ordered AS (
  SELECT v.id, v.modality,
         ROW_NUMBER() OVER (PARTITION BY v.modality ORDER BY v.start_date NULLS LAST, v.id) AS rn
  FROM v_turmas_com_vagas v
  WHERE v.turma_number IS NULL
)
UPDATE smartops_course_turmas t
SET turma_number = CASE
  WHEN o.modality = 'presencial' THEN o.rn + 137
  ELSE o.rn
END
FROM ordered o
WHERE t.id = o.id
  AND o.modality IN ('presencial','online','online_ao_vivo');

UPDATE smartops_turma_counters c
SET last_number = GREATEST(c.last_number, COALESCE((
  SELECT MAX(t.turma_number)
  FROM smartops_course_turmas t
  JOIN smartops_courses co ON co.id = t.course_id
  WHERE co.modality = c.modality
), 0)),
updated_at = now();
