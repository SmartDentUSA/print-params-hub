CREATE OR REPLACE FUNCTION public.backfill_activity_identity(p_limit integer DEFAULT 5000, p_seconds integer DEFAULT 20)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
      WHERE person_id IS NULL AND lead_id IS NOT NULL
      ORDER BY event_timestamp DESC
      LIMIT v_batch
    ),
    resolved AS (
      SELECT b.id, r.person_id, r.company_id
      FROM batch b
      CROSS JOIN LATERAL public.resolve_lead_identity(b.lead_id) r
    ),
    upd AS (
      UPDATE public.lead_activity_log lal
      SET person_id = COALESCE(lal.person_id, resolved.person_id),
          company_id = COALESCE(lal.company_id, resolved.company_id)
      FROM resolved
      WHERE lal.id = resolved.id
        AND (resolved.person_id IS NOT NULL OR resolved.company_id IS NOT NULL)
      RETURNING 1
    )
    SELECT (SELECT count(*) FROM batch), (SELECT count(*) FROM upd)
      INTO v_b_scanned, v_b_updated;

    v_scanned := v_scanned + v_b_scanned;
    v_updated := v_updated + v_b_updated;

    EXIT WHEN v_b_scanned = 0 OR v_b_updated = 0 OR clock_timestamp() >= v_deadline;
  END LOOP;

  RETURN jsonb_build_object('scanned', v_scanned, 'updated', v_updated,
    'remaining', (SELECT count(*) FROM public.lead_activity_log WHERE person_id IS NULL AND lead_id IS NOT NULL));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.backfill_activity_identity(integer, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.backfill_activity_identity(integer, integer) FROM authenticated;
DROP FUNCTION IF EXISTS public.backfill_activity_identity(integer);