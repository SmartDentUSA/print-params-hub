-- Draft-only transactional fixtures: no sends, contacts or CRM writes.
DO $test$
DECLARE
  eid uuid;
  cid uuid := gen_random_uuid();
  sid uuid := gen_random_uuid();
  pid uuid := gen_random_uuid();
  baseline integer;
  total integer;
  checked boolean := false;
BEGIN
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  SELECT id INTO eid FROM public.smartops_events ORDER BY id LIMIT 1;
  IF eid IS NULL THEN RAISE EXCEPTION 'Tests require a registered event'; END IF;
  BEGIN
    INSERT INTO public.campaigns(id,nome,canal,status) VALUES(cid,'Evento opcional - teste','sms','rascunho');
    IF (SELECT event_id IS NOT NULL FROM public.campaigns WHERE id=cid) THEN RAISE EXCEPTION 'Blank campaign event must remain null'; END IF;
    INSERT INTO public.campaign_sessions(id,name,channel,status) VALUES(sid,'Evento opcional - teste','sms','draft');
    IF (SELECT event_id IS NOT NULL FROM public.campaign_sessions WHERE id=sid) THEN RAISE EXCEPTION 'Blank session event must remain null'; END IF;
    INSERT INTO public.push_campaigns(id,title,body,status) VALUES(pid,'Evento opcional - teste','Teste sem envio','agendada');
    IF (SELECT event_id IS NOT NULL FROM public.push_campaigns WHERE id=pid) THEN RAISE EXCEPTION 'Blank push event must remain null'; END IF;
    SELECT COALESCE(sum(campanhas),0) INTO baseline FROM public.fn_event_campaign_metrics(eid) WHERE canal='sms';
    UPDATE public.campaigns SET event_id=eid WHERE id=cid;
    UPDATE public.campaign_sessions SET event_id=eid,results=jsonb_build_object('campaign_id',cid) WHERE id=sid;
    UPDATE public.push_campaigns SET event_id=eid WHERE id=pid;
    SELECT COALESCE(sum(campanhas),0) INTO total FROM public.fn_event_campaign_metrics(eid) WHERE canal='sms';
    IF total <> baseline + 1 THEN RAISE EXCEPTION 'Linked SMS and mirrored session must count exactly once: % vs %',total,baseline; END IF;
    IF NOT EXISTS(SELECT 1 FROM public.fn_event_campaign_metrics(eid) WHERE canal='push') THEN RAISE EXCEPTION 'Selected event must include push campaigns'; END IF;
    IF EXISTS(SELECT 1 FROM public.fn_event_campaign_metrics(eid) WHERE canal='push' AND custo IS NOT NULL) THEN RAISE EXCEPTION 'Missing push cost must not become fabricated zero'; END IF;
    checked := true;
    RAISE EXCEPTION USING ERRCODE='ZT001',MESSAGE='Roll back draft fixtures';
  EXCEPTION WHEN SQLSTATE 'ZT001' THEN NULL;
  END;
  IF NOT checked THEN RAISE EXCEPTION 'Tests did not complete'; END IF;
  IF EXISTS(SELECT 1 FROM public.campaigns WHERE id=cid) OR EXISTS(SELECT 1 FROM public.campaign_sessions WHERE id=sid) OR EXISTS(SELECT 1 FROM public.push_campaigns WHERE id=pid) THEN RAISE EXCEPTION 'Fixtures must be rolled back'; END IF;
END $test$;