CREATE OR REPLACE FUNCTION public.fn_piperun_stage_order(p_pipeline_id integer, p_stage_id integer)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path = public AS $function$
-- Snapshot completo: PipeRun /v1/stages, 83 etapas, 26/11/2026. IDs não representam ordem.
SELECT position FROM (VALUES
(18784,99293,0),(18784,99294,1),(18784,675815,2),(18784,675813,3),(18784,379942,4),(18784,99295,5),(18784,99296,6),(18784,448526,7),(18784,674146,8),(18784,99818,9),
(39047,706568,0),(39047,534842,1),(39047,462501,2),(39047,215389,3),(39047,215390,4),(39047,215391,5),(39047,380022,6),(39047,215392,7),(39047,708586,8),(39047,711578,9),
(70898,433601,0),(70898,433602,1),(70898,451633,2),(70898,526027,3),
(72938,447250,0),(72938,447251,1),(72938,542160,2),(72938,542161,3),(72938,447252,4),(72938,447253,5),(72938,447254,6),(72938,447255,7),(72938,544565,8),(72938,545087,9),(72938,708585,10),
(83813,523378,0),(83813,523379,1),(83813,530705,2),(83813,545636,3),(83813,565442,4),(83813,593060,5),
(83896,664117,0),(83896,523974,1),(83896,535466,2),(83896,535465,3),(83896,523977,4),(83896,619883,5),(83896,583087,6),(83896,583110,7),(83896,523976,8),(83896,523978,9),(83896,523980,10),(83896,523979,11),(83896,612326,12),(83896,525468,13),(83896,612327,14),(83896,583337,15),(83896,538897,16),(83896,568247,17),
(102702,660962,0),(102702,660964,1),(102702,711535,2),(102702,660966,3),(102702,660967,4),(102702,661003,6),
(107400,694355,0),(107400,694359,1),(107400,694360,2),(107400,694356,3),(107400,694357,4),(107400,694358,5),
(109840,710809,0),(109840,710810,1),(109840,711533,2),(109840,711531,3),(109840,711532,4),
(109841,710811,0),(109841,711534,1),(109841,710812,2),(109841,710813,3),(109841,710815,4),(109841,710816,5),(109841,710817,6)
) AS stages(pipeline_id,stage_id,position)
WHERE pipeline_id=p_pipeline_id AND stage_id=p_stage_id;
$function$;
REVOKE ALL ON FUNCTION public.fn_piperun_stage_order(integer,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_piperun_stage_order(integer,integer) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.fn_track_stage_transition()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $function$
DECLARE
 v_etapa_from text;
 v_etapa_to text;
 v_event_at timestamptz;
 v_order_from integer;
 v_order_to integer;
BEGIN
 IF OLD.piperun_stage_id IS NOT DISTINCT FROM NEW.piperun_stage_id THEN RETURN NEW; END IF;
 IF NEW.piperun_id IS NULL THEN RETURN NEW; END IF;
 IF NEW.merged_into IS NOT NULL THEN RETURN NEW; END IF;
 -- Mesma data original nos dois históricos; processamento é apenas último fallback.
 v_event_at := COALESCE(NEW.piperun_stage_changed_at,NEW.updated_at,now());
 IF NEW.piperun_pipeline_id=OLD.piperun_pipeline_id THEN
  v_order_from := public.fn_piperun_stage_order(OLD.piperun_pipeline_id,OLD.piperun_stage_id);
  v_order_to := public.fn_piperun_stage_order(NEW.piperun_pipeline_id,NEW.piperun_stage_id);
 END IF;
 v_etapa_from := CASE OLD.piperun_stage_id
 WHEN 99293 THEN 'sem_contato' WHEN 99294 THEN 'contato_feito' WHEN 379942 THEN 'em_contato'
 WHEN 99295 THEN 'apresentacao' WHEN 99296 THEN 'proposta_enviada' WHEN 448526 THEN 'negociacao'
 WHEN 99818 THEN 'fechamento' WHEN 583337 THEN 'cs_finalizado'
 ELSE COALESCE(OLD.ultima_etapa_comercial,OLD.piperun_stage_name) END;
 v_etapa_to := CASE NEW.piperun_stage_id
 WHEN 99293 THEN 'sem_contato' WHEN 99294 THEN 'contato_feito' WHEN 379942 THEN 'em_contato'
 WHEN 99295 THEN 'apresentacao' WHEN 99296 THEN 'proposta_enviada' WHEN 448526 THEN 'negociacao'
 WHEN 99818 THEN 'fechamento' WHEN 583337 THEN 'cs_finalizado'
 ELSE COALESCE(NEW.ultima_etapa_comercial,NEW.piperun_stage_name) END;
 INSERT INTO public.piperun_stage_transitions(lead_id,deal_id,pipeline_id,pipeline_name,stage_from_id,stage_from_name,etapa_from,stage_to_id,stage_to_name,etapa_to,owner_id,owner_name,deal_status,transitioned_at,source)
 VALUES(NEW.id,NEW.piperun_id,NEW.piperun_pipeline_id,NEW.piperun_pipeline_name,OLD.piperun_stage_id,OLD.piperun_stage_name,v_etapa_from,NEW.piperun_stage_id,NEW.piperun_stage_name,v_etapa_to,NEW.piperun_owner_id,NEW.proprietario_lead_crm,CASE NEW.status_oportunidade WHEN 'ganha' THEN 1 WHEN 'perdida' THEN 2 ELSE 0 END,v_event_at,'auto_trigger') ON CONFLICT DO NOTHING;
 INSERT INTO public.lead_state_events(lead_id,old_stage,new_stage,intelligence_score,cognitive_stage,owner_id,source,is_regression,regression_gap_days,changed_at)
 VALUES(NEW.id,COALESCE(v_etapa_from,OLD.piperun_stage_name,'desconhecida'),COALESCE(v_etapa_to,NEW.piperun_stage_name,'desconhecida'),NEW.intelligence_score,NEW.lead_stage_detected,NEW.piperun_owner_id,'piperun_webhook',CASE WHEN v_order_to<v_order_from THEN true ELSE false END,
 CASE WHEN OLD.piperun_stage_changed_at IS NOT NULL AND v_event_at>=OLD.piperun_stage_changed_at THEN floor(EXTRACT(EPOCH FROM (v_event_at-OLD.piperun_stage_changed_at))/86400)::integer ELSE NULL END,v_event_at);
 RETURN NEW;
END;
$function$;