
ALTER TABLE public.smartops_courses ADD COLUMN IF NOT EXISTS signup_form_url text;

CREATE OR REPLACE VIEW public.v_turmas_com_vagas AS
SELECT t.id,
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
    ( SELECT min(d.date) FROM smartops_turma_days d WHERE d.turma_id = t.id) AS start_date,
    ( SELECT min(d.start_time) FROM smartops_turma_days d WHERE d.turma_id = t.id AND d.date = (SELECT min(d2.date) FROM smartops_turma_days d2 WHERE d2.turma_id = t.id)) AS start_time,
    ( SELECT max(d.date) FROM smartops_turma_days d WHERE d.turma_id = t.id) AS end_date,
    ( SELECT max(d.end_time) FROM smartops_turma_days d WHERE d.turma_id = t.id AND d.date = (SELECT max(d2.date) FROM smartops_turma_days d2 WHERE d2.turma_id = t.id)) AS end_time,
    ( SELECT count(*) FROM smartops_turma_days d WHERE d.turma_id = t.id) AS total_days,
    c.title AS course_title,
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
    c.recurrence_weekdays,
    c.whatsapp_group_link AS course_whatsapp_group_link,
    c.related_product_ids,
    c.related_product_names,
    c.cover_image_url,
    c.signup_form_url
   FROM smartops_course_turmas t
     JOIN smartops_courses c ON c.id = t.course_id;

GRANT SELECT ON public.v_turmas_com_vagas TO anon, authenticated;
