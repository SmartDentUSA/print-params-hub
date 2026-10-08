CREATE OR REPLACE FUNCTION public.fn_form_response_timeline() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_name text;
BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.lia_attendances WHERE id=NEW.lead_id AND merged_into IS NULL) THEN RAISE EXCEPTION 'canonical lead required'; END IF;
 SELECT name INTO v_name FROM public.smartops_forms WHERE id=NEW.form_id;
 INSERT INTO public.lead_activity_log(lead_id,event_type,entity_type,entity_id,entity_name,source_channel,event_timestamp,event_data)
 VALUES(NEW.lead_id,'form_response','form_field',NEW.field_id::text,NEW.field_label,'formulario',NEW.created_at,jsonb_build_object('form_id',NEW.form_id,'form_name',v_name,'field_id',NEW.field_id,'label',NEW.field_label,'value',NEW.value,'description',NEW.field_label||': '||NEW.value,'dedupe_key','form_answer:'||NEW.id::text));
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.fn_form_response_timeline() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER trg_form_response_timeline AFTER INSERT ON public.smartops_form_field_responses FOR EACH ROW EXECUTE FUNCTION public.fn_form_response_timeline();
CREATE OR REPLACE FUNCTION public.fn_store_form_answers(p_lead_id uuid,p_form_id uuid,p_answers jsonb) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a jsonb; f public.smartops_form_fields%rowtype; n integer:=0;
BEGIN
 IF jsonb_typeof(p_answers)<>'array' OR jsonb_array_length(p_answers)>200 THEN RAISE EXCEPTION 'invalid answers'; END IF;
 PERFORM 1 FROM public.lia_attendances WHERE id=p_lead_id AND merged_into IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'canonical lead required'; END IF;
 FOR a IN SELECT value FROM jsonb_array_elements(p_answers) LOOP
  SELECT * INTO f FROM public.smartops_form_fields WHERE id=(a->>'field_id')::uuid AND form_id=p_form_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'invalid form field'; END IF;
  IF a->>'value' IS NULL OR btrim(a->>'value')='' THEN CONTINUE; END IF;
  INSERT INTO public.smartops_form_field_responses(form_id,field_id,lead_id,value,workflow_cell_target,field_label) VALUES(p_form_id,f.id,p_lead_id,a->>'value',f.workflow_cell_target,f.label);
  IF f.custom_field_name IS NOT NULL THEN
   UPDATE public.lia_attendances SET raw_payload=jsonb_set(coalesce(raw_payload,'{}'::jsonb),'{custom_fields}',coalesce(raw_payload->'custom_fields','{}'::jsonb)||jsonb_build_object(f.custom_field_name,a->>'value'),true) WHERE id=p_lead_id AND merged_into IS NULL;
  END IF;
  n:=n+1;
 END LOOP;
 RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.fn_store_form_answers(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fn_store_form_answers(uuid,uuid,jsonb) TO service_role;