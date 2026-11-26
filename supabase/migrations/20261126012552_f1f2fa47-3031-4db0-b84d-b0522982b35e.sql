DO $mig$
DECLARE d text; n text;
BEGIN
  d := pg_get_functiondef('public.fn_event_lead_stats(uuid)'::regprocedure);
  n := replace(d,
    'd.lead_id IN (SELECT x.id FROM public.lia_attendances x WHERE x.id = a.lead_id OR x.merged_into = a.lead_id)',
    'd.lead_id = ANY (ARRAY(SELECT a.lead_id UNION SELECT x.id FROM public.lia_attendances x WHERE x.merged_into = a.lead_id))');
  IF n = d THEN RAISE EXCEPTION 'trecho não encontrado'; END IF;
  EXECUTE n;
END $mig$;