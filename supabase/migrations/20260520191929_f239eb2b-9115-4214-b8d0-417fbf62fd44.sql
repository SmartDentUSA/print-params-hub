DROP VIEW IF EXISTS public.v_turmas_com_vagas CASCADE;

CREATE VIEW public.v_turmas_com_vagas AS
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
    d1.date AS start_date,
    d1.start_time,
    d_last.date AS end_date,
    d_last.end_time,
    ( SELECT count(*) FROM smartops_turma_days WHERE turma_id = t.id) AS total_days,
    c.title AS course_title,
    c.modality,
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
    t.turma_number
   FROM smartops_course_turmas t
     JOIN smartops_courses c ON c.id = t.course_id
     LEFT JOIN LATERAL ( SELECT date, start_time FROM smartops_turma_days WHERE turma_id = t.id ORDER BY day_number LIMIT 1) d1 ON true
     LEFT JOIN LATERAL ( SELECT date, end_time FROM smartops_turma_days WHERE turma_id = t.id ORDER BY day_number DESC LIMIT 1) d_last ON true;