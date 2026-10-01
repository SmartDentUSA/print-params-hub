DO $do$
DECLARE v text;
BEGIN
  v := pg_get_functiondef('public.fn_event_lead_stats(uuid)'::regprocedure);
  v := replace(v,
    'select l.id, l.event_id, l.form_data, l.created_at,',
    'select l.id, l.event_id, l.form_data, greatest(l.created_at, coalesce(ev.start_date::timestamptz, l.created_at)) as created_at,');
  v := replace(v,
    'left join public.team_members tm on tm.id = l.event_consultant_team_member_id',
    'left join public.team_members tm on tm.id = l.event_consultant_team_member_id
     left join public.smartops_events ev on ev.id = l.event_id');
  IF position('ev.start_date' in v) = 0 THEN RAISE EXCEPTION 'patch failed'; END IF;
  EXECUTE v;
END $do$;