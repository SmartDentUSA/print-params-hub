CREATE OR REPLACE FUNCTION public.vendas_snapshot_at(cutoff timestamptz)
RETURNS TABLE(deal_id text, stage_to_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT ON (t.deal_id) t.deal_id, t.stage_to_name
  FROM public.piperun_stage_transitions t
  WHERE t.pipeline_id = 18784
    AND t.created_at <= cutoff
  ORDER BY t.deal_id, t.created_at DESC
$$;

GRANT EXECUTE ON FUNCTION public.vendas_snapshot_at(timestamptz) TO service_role, authenticated;