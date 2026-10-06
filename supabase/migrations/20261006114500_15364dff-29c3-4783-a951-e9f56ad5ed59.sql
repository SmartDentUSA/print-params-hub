DO $m$
DECLARE d text;
BEGIN
  d := pg_get_functiondef('public.fn_campaign_revenue(date,date)'::regprocedure);
  d := replace(d, 'COALESCE((SELECT MAX(e.converted_at) FROM ad_events e WHERE e.lead_id = la.id), la.entrada_sistema, la.created_at)',
                  '(SELECT MAX(e.converted_at) FROM ad_events e WHERE e.lead_id = la.id)');
  d := replace(d, 'AND NOT EXISTS (SELECT 1 FROM exact_conversions e WHERE e.lead_id = la.id)',
                  'AND NOT EXISTS (SELECT 1 FROM exact_conversions e WHERE e.lead_id = la.id)
    AND EXISTS (SELECT 1 FROM ad_events e WHERE e.lead_id = la.id)');
  EXECUTE d;
END $m$;