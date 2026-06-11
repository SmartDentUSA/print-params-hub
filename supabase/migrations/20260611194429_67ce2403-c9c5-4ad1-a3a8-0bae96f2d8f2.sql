
-- Add recurrence_weekdays and extend recurrence types to include 'hours' and 'weekdays'
ALTER TABLE public.smartops_courses
  ADD COLUMN IF NOT EXISTS recurrence_weekdays integer[] DEFAULT NULL;

COMMENT ON COLUMN public.smartops_courses.recurrence_weekdays IS
  'When recurrence_type = ''weekdays'': ISO weekdays 1=Mon..7=Sun to generate sessions on';

-- Recreate view to expose cover_image_url + recurrence_weekdays
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
  (SELECT MIN(d.date) FROM smartops_turma_days d WHERE d.turma_id = t.id) AS start_date,
  (SELECT MIN(d.start_time) FROM smartops_turma_days d WHERE d.turma_id = t.id AND d.date = (SELECT MIN(d2.date) FROM smartops_turma_days d2 WHERE d2.turma_id = t.id)) AS start_time,
  (SELECT MAX(d.date) FROM smartops_turma_days d WHERE d.turma_id = t.id) AS end_date,
  (SELECT MAX(d.end_time) FROM smartops_turma_days d WHERE d.turma_id = t.id AND d.date = (SELECT MAX(d2.date) FROM smartops_turma_days d2 WHERE d2.turma_id = t.id)) AS end_time,
  (SELECT COUNT(*) FROM smartops_turma_days d WHERE d.turma_id = t.id) AS total_days,
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
  c.cover_image_url
FROM public.smartops_course_turmas t
JOIN public.smartops_courses c ON c.id = t.course_id;

GRANT SELECT ON public.v_turmas_com_vagas TO anon, authenticated;
GRANT ALL    ON public.v_turmas_com_vagas TO service_role;

-- Updated RPC: supports days/weeks/months/hours/weekdays
CREATE OR REPLACE FUNCTION public.fn_generate_recurrent_turmas(
  p_course_id uuid, p_base_date date, p_slots integer, p_template_label text
) RETURNS integer
LANGUAGE plpgsql
AS $function$
DECLARE
  v_course       RECORD;
  v_current      TIMESTAMP;
  v_until        TIMESTAMP;
  v_parent_id    UUID;
  v_turma_id     UUID;
  v_index        INTEGER := 0;
  v_count        INTEGER := 0;
  v_label        TEXT;
  v_dow          INTEGER;
BEGIN
  SELECT * INTO v_course FROM smartops_courses WHERE id = p_course_id;

  IF NOT v_course.recurrence_enabled
     OR v_course.recurrence_type IS NULL
     OR v_course.recurrence_until IS NULL THEN
    RAISE EXCEPTION 'Curso não configurado para recorrência';
  END IF;

  IF v_course.modality NOT IN ('online', 'online_ao_vivo') THEN
    RAISE EXCEPTION 'Recorrência disponível apenas para cursos online';
  END IF;

  DELETE FROM smartops_course_turmas
  WHERE course_id = p_course_id AND recurrence_parent_id IS NOT NULL;
  -- Also delete any parent regenerated to avoid duplicates
  DELETE FROM smartops_course_turmas
  WHERE course_id = p_course_id AND recurrence_index IS NOT NULL AND recurrence_parent_id IS NULL;

  v_current := (p_base_date::text || ' ' || COALESCE(v_course.recurrence_time_start::text,'09:00'))::timestamp;
  v_until   := (v_course.recurrence_until::text || ' 23:59:59')::timestamp;

  WHILE v_current <= v_until AND v_count < 500 LOOP
    -- For weekdays mode, skip dates not in the selected ISO weekdays array
    IF v_course.recurrence_type = 'weekdays' THEN
      v_dow := EXTRACT(ISODOW FROM v_current)::integer;
      IF v_course.recurrence_weekdays IS NULL OR NOT (v_dow = ANY(v_course.recurrence_weekdays)) THEN
        v_current := v_current + INTERVAL '1 day';
        CONTINUE;
      END IF;
    END IF;

    v_index := v_index + 1;
    v_label := p_template_label || ' — ' || TO_CHAR(v_current,
      CASE WHEN v_course.recurrence_type = 'hours' THEN 'DD/MM HH24:MI' ELSE 'DD/MM/YYYY' END);

    IF v_index = 1 THEN
      INSERT INTO smartops_course_turmas (course_id, label, slots, sort_order, recurrence_index)
      VALUES (p_course_id, v_label, p_slots, 0, 1)
      RETURNING id INTO v_parent_id;
      v_turma_id := v_parent_id;
    ELSE
      INSERT INTO smartops_course_turmas
        (course_id, label, slots, sort_order, recurrence_parent_id, recurrence_index)
      VALUES
        (p_course_id, v_label, p_slots, v_index - 1, v_parent_id, v_index)
      RETURNING id INTO v_turma_id;
    END IF;

    INSERT INTO smartops_turma_days (turma_id, day_number, date, start_time, end_time)
    VALUES (v_turma_id, 1, v_current::date,
            v_current::time,
            (v_current + (COALESCE(v_course.recurrence_time_end,'11:00') - COALESCE(v_course.recurrence_time_start,'09:00')))::time);

    v_count := v_count + 1;

    v_current := CASE v_course.recurrence_type
      WHEN 'hours'    THEN v_current + (v_course.recurrence_interval || ' hours')::INTERVAL
      WHEN 'days'     THEN v_current + (v_course.recurrence_interval || ' days')::INTERVAL
      WHEN 'weeks'    THEN v_current + (v_course.recurrence_interval * 7 || ' days')::INTERVAL
      WHEN 'months'   THEN v_current + (v_course.recurrence_interval || ' months')::INTERVAL
      WHEN 'weekdays' THEN v_current + INTERVAL '1 day'
    END;
  END LOOP;

  RETURN v_count;
END;
$function$;
