CREATE OR REPLACE FUNCTION public.fn_register_presencial_or_waitlist(p_course_id uuid, p_turma_id uuid, p_lead_id uuid, p_name text, p_phone text, p_email text, p_enrollment jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE t public.smartops_course_turmas%ROWTYPE; c public.smartops_courses%ROWTYPE; existing_id uuid; wait_id uuid; occupied integer;
BEGIN
 SELECT * INTO t FROM public.smartops_course_turmas WHERE id=p_turma_id AND course_id=p_course_id AND active=true FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'turma_not_available'; END IF;
 SELECT * INTO c FROM public.smartops_courses WHERE id=p_course_id AND active=true AND public_enrollment_enabled=true AND modality='presencial';
 IF NOT FOUND THEN RAISE EXCEPTION 'course_not_available'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.lia_attendances WHERE id=p_lead_id AND merged_into IS NULL) THEN RAISE EXCEPTION 'canonical_lead_required'; END IF;
 SELECT id INTO existing_id FROM public.smartops_course_enrollments WHERE turma_id=p_turma_id AND lead_id=p_lead_id AND status NOT IN ('cancelado','nao_compareceu') LIMIT 1;
 IF existing_id IS NOT NULL THEN RETURN jsonb_build_object('status','confirmed','enrollment_id',existing_id,'reused',true); END IF;
 SELECT id INTO wait_id FROM public.smartops_turma_waitlist WHERE turma_id=p_turma_id AND (lead_id=p_lead_id OR lower(email)=lower(p_email)) ORDER BY created_at LIMIT 1;
 IF wait_id IS NOT NULL THEN RETURN jsonb_build_object('status','waitlisted','waitlist_id',wait_id,'reused',true); END IF;
 SELECT count(*) INTO occupied FROM public.smartops_course_enrollments WHERE turma_id=p_turma_id AND status != 'cancelado';
 IF occupied >= t.slots THEN
  IF NOT COALESCE(c.waitlist_enabled,false) THEN RAISE EXCEPTION 'turma_full'; END IF;
  INSERT INTO public.smartops_turma_waitlist(turma_id,course_id,lead_id,person_name,phone,email) VALUES(p_turma_id,p_course_id,p_lead_id,p_name,p_phone,p_email) RETURNING id INTO wait_id;
  RETURN jsonb_build_object('status','waitlisted','waitlist_id',wait_id,'reused',false);
 END IF;
 INSERT INTO public.smartops_course_enrollments(course_id,turma_id,lead_id,person_name,status,enrolled_at,source,turma_snapshot,wa_reminder_scheduled_for,wa_sent_at,is_client_smartdent,public_form_payload,especialidade,area_atuacao)
 VALUES(p_course_id,p_turma_id,p_lead_id,p_name,'agendado',now(),'public',p_enrollment->'turma_snapshot',NULL,now(),COALESCE((p_enrollment->>'is_client_smartdent')::boolean,false),p_enrollment->'public_form_payload',NULLIF(p_enrollment->>'especialidade',''),NULLIF(p_enrollment->>'area_atuacao','')) RETURNING id INTO existing_id;
 RETURN jsonb_build_object('status','confirmed','enrollment_id',existing_id,'reused',false);
END;
$function$;

UPDATE public.smartops_course_enrollments e
SET especialidade = COALESCE(NULLIF(e.especialidade,''), l.especialidade),
    area_atuacao = COALESCE(NULLIF(e.area_atuacao,''), l.area_atuacao)
FROM public.lia_attendances l
WHERE e.lead_id = l.id
  AND (NULLIF(e.especialidade,'') IS NULL OR NULLIF(e.area_atuacao,'') IS NULL);