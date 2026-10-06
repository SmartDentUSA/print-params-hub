DO $m$
DECLARE d text; o oid;
BEGIN
  SELECT oid INTO o FROM pg_proc WHERE proname='fn_campaign_revenue_detail' AND pronamespace='public'::regnamespace;
  d := pg_get_functiondef(o);
  d := replace(d, 'COALESCE(
           (SELECT MAX(e.converted_at) FROM ad_events e WHERE e.lead_id = la.id),
           la.entrada_sistema, la.created_at
         )', '(SELECT MAX(e.converted_at) FROM ad_events e WHERE e.lead_id = la.id)');
  d := replace(d, 'AND NOT EXISTS (SELECT 1 FROM exact_conversions e WHERE e.lead_id = la.id)',
                  'AND NOT EXISTS (SELECT 1 FROM exact_conversions e WHERE e.lead_id = la.id)
    AND EXISTS (SELECT 1 FROM ad_events e WHERE e.lead_id = la.id)');
  IF position('entrada_sistema' in d) > 0 THEN RAISE EXCEPTION 'replace failed'; END IF;
  EXECUTE d;
END $m$;