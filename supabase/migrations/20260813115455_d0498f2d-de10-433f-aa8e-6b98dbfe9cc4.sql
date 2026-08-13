UPDATE public.smartops_courses c
SET public_visible = true, updated_at = now()
WHERE c.active = true
  AND c.public_visible IS DISTINCT FROM true
  AND EXISTS (
    SELECT 1 FROM public.smartops_course_turmas t
    WHERE t.course_id = c.id
      AND t.active = true
      AND COALESCE(t.end_date, t.start_date) >= current_date
  );