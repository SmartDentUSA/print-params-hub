DO $$
DECLARE def text;
BEGIN
  def := pg_get_functiondef('public.fn_event_lead_stats'::regproc);
  def := replace(def,
    'COALESCE(sum(d.value), 0)::numeric AS value_won',
    'COALESCE(sum(CASE WHEN COALESCE(d.value,0) > 0 THEN d.value ELSE (SELECT COALESCE(sum(i.total_value),0) FROM public.deal_items i WHERE i.deal_id = d.piperun_deal_id::text AND i.source = ''omie_nf'') END), 0)::numeric AS value_won');
  IF position('omie_nf' in def) = 0 THEN RAISE EXCEPTION 'pattern not found'; END IF;
  EXECUTE def;
END $$;