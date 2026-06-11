
ALTER TABLE public.smartops_courses
  ADD COLUMN IF NOT EXISTS related_product_ids   uuid[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS related_product_names text[]  NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.smartops_courses.related_product_ids   IS 'IDs do system_a_catalog associados ao curso online (multi-select no editor).';
COMMENT ON COLUMN public.smartops_courses.related_product_names IS 'Snapshot dos nomes — usado na agenda pública para evitar JOIN.';

DROP VIEW IF EXISTS public.v_turmas_com_vagas CASCADE;
CREATE VIEW public.v_turmas_com_vagas AS
SELECT
  t.id,
  t.course_id,
  t.label,
  t.slots,
  t.enrolled_count,
  GREATEST(t.slots - t.enrolled_count, 0) AS vagas_disponiveis,
  t.sellflux_tag,
  t.whatsapp_group_link,
  t.active,
  t.sort_order,
  t.launch_date,
  t.recurrence_parent_id,
  t.recurrence_index,
  t.turma_number,
  (SELECT MIN(d.date) FROM public.smartops_turma_days d WHERE d.turma_id = t.id) AS start_date,
  (SELECT d.start_time FROM public.smartops_turma_days d WHERE d.turma_id = t.id ORDER BY d.date ASC LIMIT 1) AS start_time,
  (SELECT MAX(d.date) FROM public.smartops_turma_days d WHERE d.turma_id = t.id) AS end_date,
  (SELECT d.end_time FROM public.smartops_turma_days d WHERE d.turma_id = t.id ORDER BY d.date DESC LIMIT 1) AS end_time,
  (SELECT COUNT(*) FROM public.smartops_turma_days d WHERE d.turma_id = t.id) AS total_days,
  c.title       AS course_title,
  c.modality,
  c.category,
  c.instructor_name,
  c.location,
  c.meeting_link,
  c.pipeline_id_kanban,
  c.stage_after_enroll,
  c.recurrence_enabled,
  c.recurrence_type,
  c.recurrence_interval,
  c.recurrence_until,
  c.whatsapp_group_link AS course_whatsapp_group_link,
  c.related_product_ids,
  c.related_product_names
FROM public.smartops_course_turmas t
JOIN public.smartops_courses c ON c.id = t.course_id;

GRANT SELECT ON public.v_turmas_com_vagas TO anon, authenticated;
GRANT ALL    ON public.v_turmas_com_vagas TO service_role;
