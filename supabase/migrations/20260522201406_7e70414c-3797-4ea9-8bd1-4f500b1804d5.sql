
CREATE OR REPLACE FUNCTION public.get_copilot_brain()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, copilot_brain
AS $$
  SELECT jsonb_build_object(
    'meta',          COALESCE((SELECT jsonb_agg(to_jsonb(m)) FROM copilot_brain.brain_meta m), '[]'::jsonb),
    'overview',      (SELECT to_jsonb(o) FROM copilot_brain.brain_overview o WHERE id=1),
    'sales_month',   COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.ano DESC, x.mes DESC)
                               FROM copilot_brain.brain_sales_month x), '[]'::jsonb),
    'sales_ranking', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.ano DESC, x.mes DESC, x.ordem ASC)
                               FROM copilot_brain.brain_sales_ranking x), '[]'::jsonb),
    'pipeline',      COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM copilot_brain.brain_pipeline x), '[]'::jsonb),
    'products_sold', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.ano DESC, x.mes DESC, x.ordem ASC)
                               FROM copilot_brain.brain_products_sold x), '[]'::jsonb),
    'equipment',     COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.lead_count DESC NULLS LAST)
                               FROM copilot_brain.brain_equipment x), '[]'::jsonb),
    'alerts',        COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM copilot_brain.brain_alerts x), '[]'::jsonb)
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_copilot_brain() TO authenticated, service_role, anon;
