-- Restoration RPC for Vendas (18784) — returns deals whose owner OR stage
-- changed since the snapshot cutoff, scoped to a list of original owners.
-- Excludes: "Sem contato" stage, closed deals (ganha/perdida), CS Onboarding,
-- Ganhos, and merged leads. Used by smart-ops-restore-vendas-snapshot.
CREATE OR REPLACE FUNCTION public.vendas_restore_owner_stage_at(
  cutoff timestamptz,
  owner_ids int[]
)
RETURNS TABLE(
  deal_id text,
  lead_id uuid,
  snapshot_owner_id int,
  snapshot_owner_name text,
  snapshot_stage_id int,
  snapshot_stage_name text,
  current_pipeline_id int,
  current_owner_id int,
  current_stage_id int,
  current_stage_name text,
  current_status smallint
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH snap AS (
    SELECT DISTINCT ON (pst.deal_id)
      pst.deal_id::text AS deal_id,
      pst.owner_id      AS snap_owner_id,
      pst.owner_name    AS snap_owner_name,
      pst.stage_to_id   AS snap_stage_id,
      pst.stage_to_name AS snap_stage_name,
      COALESCE(pst.deal_status, 0) AS snap_status
    FROM public.piperun_stage_transitions pst
    WHERE pst.pipeline_id = 18784
      AND pst.created_at <= cutoff
    ORDER BY pst.deal_id, pst.created_at DESC
  ),
  snap_eligible AS (
    SELECT *
    FROM snap
    WHERE snap_owner_id = ANY(owner_ids)
      AND COALESCE(snap_stage_name,'') NOT ILIKE '%sem contato%'
      AND snap_status = 0
  )
  SELECT
    s.deal_id,
    la.id                       AS lead_id,
    s.snap_owner_id             AS snapshot_owner_id,
    s.snap_owner_name           AS snapshot_owner_name,
    s.snap_stage_id             AS snapshot_stage_id,
    s.snap_stage_name           AS snapshot_stage_name,
    la.piperun_pipeline_id      AS current_pipeline_id,
    la.piperun_owner_id         AS current_owner_id,
    la.piperun_stage_id         AS current_stage_id,
    la.piperun_stage_name       AS current_stage_name,
    la.piperun_status           AS current_status
  FROM snap_eligible s
  JOIN public.lia_attendances la
    ON la.piperun_id::text = s.deal_id
   AND la.merged_into IS NULL
  WHERE la.piperun_pipeline_id IN (18784, 72938)
    AND COALESCE(la.piperun_status, 0) = 0
    AND (
      la.piperun_owner_id IS DISTINCT FROM s.snap_owner_id
      OR la.piperun_stage_id IS DISTINCT FROM s.snap_stage_id
      OR la.piperun_pipeline_id <> 18784
    );
$function$;

GRANT EXECUTE ON FUNCTION public.vendas_restore_owner_stage_at(timestamptz, int[]) TO service_role;