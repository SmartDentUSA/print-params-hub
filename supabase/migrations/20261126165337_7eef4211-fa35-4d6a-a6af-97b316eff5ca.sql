DO $test$
DECLARE
 lid uuid; checked boolean := false; e public.lead_state_events%ROWTYPE; n integer; history_id uuid; history_before jsonb;
BEGIN
 SELECT l.id INTO lid FROM public.lia_attendances l WHERE l.merged_into IS NULL AND NOT EXISTS(SELECT 1 FROM public.lead_state_events s WHERE s.lead_id=l.id) AND NOT EXISTS(SELECT 1 FROM public.piperun_stage_transitions s WHERE s.lead_id=l.id) LIMIT 1;
 IF lid IS NULL THEN RAISE EXCEPTION 'Test requires a canonical lead with no transition history'; END IF;
 SELECT id,to_jsonb(s) INTO history_id,history_before FROM public.lead_state_events s ORDER BY changed_at DESC LIMIT 1;
 BEGIN
 ALTER TABLE public.piperun_stage_transitions DISABLE TRIGGER trg_email_flow_stage;
 CREATE TEMP TABLE stage_transition_fixture ON COMMIT DROP AS SELECT * FROM public.lia_attendances WHERE merged_into IS NULL AND false WITH NO DATA;
 CREATE TRIGGER stage_transition_fixture_trigger AFTER UPDATE OF piperun_stage_id ON stage_transition_fixture FOR EACH ROW EXECUTE FUNCTION public.fn_track_stage_transition();
 ALTER TABLE stage_transition_fixture ENABLE ALWAYS TRIGGER stage_transition_fixture_trigger;
 INSERT INTO stage_transition_fixture(id,piperun_id,piperun_pipeline_id,piperun_stage_id,piperun_stage_name,piperun_stage_changed_at,updated_at,piperun_owner_id) VALUES(lid,'isolated-stage-transition-test',18784,379942,'SDR / Nutrição','2026-11-16 12:00:00+00','2026-11-26 12:00:00+00',104356);
 UPDATE stage_transition_fixture SET piperun_stage_id=99295,piperun_stage_name='Apresentação/Visita',piperun_stage_changed_at='2026-11-18 18:00:00+00';
 SELECT * INTO STRICT e FROM public.lead_state_events WHERE lead_id=lid;
 IF e.is_regression THEN RAISE EXCEPTION 'Forward SDR to Apresentação incorrectly marked regression'; END IF;
 IF e.changed_at IS DISTINCT FROM '2026-11-18 18:00:00+00'::timestamptz THEN RAISE EXCEPTION 'Original date lost'; END IF;
 IF e.regression_gap_days IS DISTINCT FROM 2 THEN RAISE EXCEPTION 'Expected 2 days between original events, got %',e.regression_gap_days; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.piperun_stage_transitions WHERE lead_id=lid AND transitioned_at=e.changed_at) THEN RAISE EXCEPTION 'Both histories must share original date'; END IF;
 IF e.owner_id IS DISTINCT FROM '104356' THEN RAISE EXCEPTION 'Owner snapshot changed'; END IF;
 UPDATE stage_transition_fixture SET piperun_stage_id=379942,piperun_stage_changed_at='2026-11-19 18:00:00+00';
 SELECT * INTO STRICT e FROM public.lead_state_events WHERE lead_id=lid AND changed_at='2026-11-19 18:00:00+00';
 IF NOT e.is_regression THEN RAISE EXCEPTION 'Apresentação to SDR must be regression'; END IF;
 UPDATE stage_transition_fixture SET piperun_pipeline_id=83896,piperun_stage_id=523974,piperun_stage_changed_at='2026-11-20 18:00:00+00';
 SELECT * INTO STRICT e FROM public.lead_state_events WHERE lead_id=lid AND changed_at='2026-11-20 18:00:00+00';
 IF e.is_regression THEN RAISE EXCEPTION 'Cross-pipeline change is not regression'; END IF;
 UPDATE stage_transition_fixture SET piperun_stage_id=1,piperun_stage_changed_at='2026-11-21 18:00:00+00';
 SELECT * INTO STRICT e FROM public.lead_state_events WHERE lead_id=lid AND changed_at='2026-11-21 18:00:00+00';
 IF e.is_regression THEN RAISE EXCEPTION 'Unknown stage must not use numeric ID'; END IF;
 UPDATE stage_transition_fixture SET piperun_stage_id=583337,piperun_stage_changed_at='2026-11-17 18:00:00+00';
 SELECT * INTO STRICT e FROM public.lead_state_events WHERE lead_id=lid AND changed_at='2026-11-17 18:00:00+00';
 IF e.regression_gap_days IS NOT NULL THEN RAISE EXCEPTION 'Out-of-order event must not invent elapsed days'; END IF;
 UPDATE stage_transition_fixture SET piperun_stage_id=523974,piperun_stage_changed_at=NULL,updated_at='2026-11-22 18:00:00+00';
 SELECT * INTO STRICT e FROM public.lead_state_events WHERE lead_id=lid AND changed_at='2026-11-22 18:00:00+00';
 IF NOT e.is_regression THEN RAISE EXCEPTION 'CS Finalizado to Novos clientes must regress'; END IF;
 SELECT count(*) INTO n FROM public.lead_state_events WHERE lead_id=lid;
 UPDATE stage_transition_fixture SET piperun_stage_id=523974;
 IF (SELECT count(*) FROM public.lead_state_events WHERE lead_id=lid)<>n THEN RAISE EXCEPTION 'Unchanged stage produced event'; END IF;
 UPDATE stage_transition_fixture SET merged_into=gen_random_uuid(),piperun_stage_id=583337;
 IF (SELECT count(*) FROM public.lead_state_events WHERE lead_id=lid)<>n THEN RAISE EXCEPTION 'Merged lead produced event'; END IF;
 IF history_id IS NOT NULL AND (SELECT to_jsonb(s) FROM public.lead_state_events s WHERE id=history_id) IS DISTINCT FROM history_before THEN RAISE EXCEPTION 'Existing history changed'; END IF;
 checked := true;
 RAISE EXCEPTION USING ERRCODE='ZT001',MESSAGE='Rollback isolated fixtures';
 EXCEPTION WHEN SQLSTATE 'ZT001' THEN NULL;
 END;
 IF NOT checked THEN RAISE EXCEPTION 'Transition tests did not complete'; END IF;
 IF EXISTS(SELECT 1 FROM public.lead_state_events WHERE lead_id=lid) OR EXISTS(SELECT 1 FROM public.piperun_stage_transitions WHERE lead_id=lid) THEN RAISE EXCEPTION 'Test fixtures leaked'; END IF;
END $test$;