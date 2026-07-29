ALTER TABLE public.lead_activity_log
  ADD COLUMN IF NOT EXISTS identity_resolved_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_lal_identity_pending
  ON public.lead_activity_log (id)
  WHERE identity_resolved_at IS NULL AND lead_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.backfill_activity_identity(p_limit integer DEFAULT 5000, p_seconds integer DEFAULT 20)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_updated integer := 0;
  v_scanned integer := 0;
  v_b_scanned integer;
  v_b_updated integer;
  v_batch integer := GREATEST(1, LEAST(p_limit, 20000));
  v_deadline timestamptz := clock_timestamp() + make_interval(secs => GREATEST(1, LEAST(p_seconds, 55)));
BEGIN
  LOOP
    WITH batch AS (
      SELECT id, lead_id
      FROM public.lead_activity_log
      WHERE identity_resolved_at IS NULL
        AND person_id IS NULL
        AND lead_id IS NOT NULL
      ORDER BY id
      LIMIT v_batch
      FOR UPDATE SKIP LOCKED
    ),
    resolved AS (
      SELECT b.id, r.person_id, r.company_id
      FROM batch b
      CROSS JOIN LATERAL public.resolve_lead_identity(b.lead_id) r
    ),
    upd AS (
      UPDATE public.lead_activity_log lal
      SET person_id = COALESCE(lal.person_id, resolved.person_id),
          company_id = COALESCE(lal.company_id, resolved.company_id),
          identity_resolved_at = now()
      FROM resolved
      WHERE lal.id = resolved.id
      RETURNING (resolved.person_id IS NOT NULL OR resolved.company_id IS NOT NULL) AS hit
    )
    SELECT (SELECT count(*) FROM batch), (SELECT count(*) FROM upd WHERE hit)
      INTO v_b_scanned, v_b_updated;

    v_scanned := v_scanned + v_b_scanned;
    v_updated := v_updated + v_b_updated;

    EXIT WHEN v_b_scanned = 0 OR clock_timestamp() >= v_deadline;
  END LOOP;

  RETURN jsonb_build_object(
    'scanned', v_scanned,
    'updated', v_updated,
    'remaining', (SELECT count(*) FROM public.lead_activity_log
                  WHERE identity_resolved_at IS NULL AND person_id IS NULL AND lead_id IS NOT NULL));
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.backfill_activity_identity(integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.backfill_activity_identity(integer, integer) TO service_role;