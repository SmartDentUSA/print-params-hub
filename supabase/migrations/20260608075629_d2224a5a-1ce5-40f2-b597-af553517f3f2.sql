DROP FUNCTION IF EXISTS public.vendas_snapshot_at(timestamptz);

CREATE FUNCTION public.vendas_snapshot_at(cutoff timestamptz)
RETURNS TABLE (deal_id text, stage_to_name text, deal_status integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT ON (deal_id)
    deal_id::text,
    stage_to_name,
    COALESCE(deal_status, 0)
  FROM public.piperun_stage_transitions
  WHERE pipeline_id = 18784
    AND created_at <= cutoff
  ORDER BY deal_id, created_at DESC
$$;

GRANT EXECUTE ON FUNCTION public.vendas_snapshot_at(timestamptz) TO authenticated, service_role;