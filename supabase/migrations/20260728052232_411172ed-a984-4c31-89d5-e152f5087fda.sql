REVOKE ALL ON public.v_gate2_orphan_lead_id_columns FROM anon, authenticated, PUBLIC;
REVOKE ALL ON public.v_gate2_edge_function_config_drift FROM anon, authenticated, PUBLIC;

GRANT SELECT ON public.v_gate2_orphan_lead_id_columns TO service_role;
GRANT SELECT ON public.v_gate2_edge_function_config_drift TO service_role;