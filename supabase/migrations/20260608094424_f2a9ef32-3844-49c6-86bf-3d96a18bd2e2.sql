
CREATE OR REPLACE FUNCTION public.vendas_restore_from_estagnados_since(cutoff timestamptz)
RETURNS TABLE (
  deal_id text,
  lead_id uuid,
  current_owner_id integer,
  current_pipeline_id integer,
  current_stage_id integer,
  current_stage_name text,
  target_stage_id integer,
  target_stage_name text,
  origin_first_entry_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH first_entry AS (
    SELECT DISTINCT ON (deal_id)
      deal_id, transitioned_at AS entered_at
    FROM piperun_stage_transitions
    WHERE pipeline_id = 72938
    ORDER BY deal_id, transitioned_at ASC
  ),
  moved_since AS (
    SELECT DISTINCT deal_id
    FROM piperun_stage_transitions
    WHERE pipeline_id = 72938
      AND transitioned_at >= cutoff
  ),
  origin AS (
    SELECT
      f.deal_id,
      f.entered_at,
      (
        SELECT stage_to_id FROM piperun_stage_transitions p
        WHERE p.deal_id = f.deal_id
          AND p.pipeline_id = 18784
          AND p.transitioned_at < f.entered_at
        ORDER BY p.transitioned_at DESC LIMIT 1
      ) AS origin_stage_id,
      (
        SELECT stage_to_name FROM piperun_stage_transitions p
        WHERE p.deal_id = f.deal_id
          AND p.pipeline_id = 18784
          AND p.transitioned_at < f.entered_at
        ORDER BY p.transitioned_at DESC LIMIT 1
      ) AS origin_stage_name
    FROM first_entry f
    WHERE f.deal_id IN (SELECT deal_id FROM moved_since)
  )
  SELECT
    o.deal_id::text,
    la.id AS lead_id,
    la.piperun_owner_id AS current_owner_id,
    la.piperun_pipeline_id AS current_pipeline_id,
    la.piperun_stage_id AS current_stage_id,
    la.piperun_stage_name AS current_stage_name,
    CASE
      WHEN o.origin_stage_id IS NULL THEN NULL
      WHEN o.origin_stage_name ILIKE '%sem contato%' THEN 99294
      ELSE o.origin_stage_id
    END AS target_stage_id,
    CASE
      WHEN o.origin_stage_id IS NULL THEN NULL
      WHEN o.origin_stage_name ILIKE '%sem contato%' THEN 'C1'
      ELSE o.origin_stage_name
    END AS target_stage_name,
    o.entered_at AS origin_first_entry_at
  FROM origin o
  JOIN deals d ON d.piperun_deal_id = o.deal_id::text
  JOIN lia_attendances la
    ON la.id = d.lead_id
   AND la.merged_into IS NULL
   AND la.piperun_pipeline_id = 72938
   AND COALESCE(la.piperun_status, 0) = 0
  WHERE o.origin_stage_id IS NOT NULL;
$$;

GRANT EXECUTE ON FUNCTION public.vendas_restore_from_estagnados_since(timestamptz) TO service_role;
