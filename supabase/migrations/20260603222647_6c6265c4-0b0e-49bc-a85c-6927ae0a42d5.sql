CREATE OR REPLACE FUNCTION public.try_claim_seller_note_slot(
  p_deal_id BIGINT,
  p_lead_id UUID,
  p_content_hash TEXT,
  p_ttl_seconds INTEGER DEFAULT 86400,
  p_burst_floor_seconds INTEGER DEFAULT 60
)
RETURNS TABLE (claimed BOOLEAN, reason TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := now();
  v_burst_exists BOOLEAN;
BEGIN
  IF p_deal_id IS NULL OR p_content_hash IS NULL OR p_content_hash = '' THEN
    RETURN QUERY SELECT FALSE, 'claim_error'::TEXT;
    RETURN;
  END IF;

  -- Per-lead anti-burst: another deal of the same lead posted within last N seconds
  IF p_lead_id IS NOT NULL AND p_burst_floor_seconds > 0 THEN
    SELECT EXISTS (
      SELECT 1
        FROM public.smartops_deal_note_locks
       WHERE lead_id = p_lead_id
         AND deal_id <> p_deal_id
         AND posted_at > v_now - make_interval(secs => p_burst_floor_seconds)
    ) INTO v_burst_exists;
    IF v_burst_exists THEN
      RETURN QUERY SELECT FALSE, 'lead_burst_floor'::TEXT;
      RETURN;
    END IF;
  END IF;

  -- Atomic upsert; only "wins" when row is new, hash changed, or TTL elapsed.
  -- Single statement ⇒ Postgres serialises concurrent callers; losers see WHERE fail and update 0 rows.
  WITH ins AS (
    INSERT INTO public.smartops_deal_note_locks (deal_id, lead_id, content_hash, posted_at, updated_at)
    VALUES (p_deal_id, p_lead_id, p_content_hash, v_now, v_now)
    ON CONFLICT (deal_id) DO UPDATE
      SET content_hash = EXCLUDED.content_hash,
          lead_id      = COALESCE(EXCLUDED.lead_id, public.smartops_deal_note_locks.lead_id),
          posted_at    = EXCLUDED.posted_at,
          updated_at   = EXCLUDED.updated_at
      WHERE public.smartops_deal_note_locks.content_hash IS DISTINCT FROM EXCLUDED.content_hash
         OR public.smartops_deal_note_locks.posted_at < v_now - make_interval(secs => p_ttl_seconds)
    RETURNING 1
  )
  SELECT EXISTS (SELECT 1 FROM ins) INTO v_burst_exists;

  IF v_burst_exists THEN
    RETURN QUERY SELECT TRUE, NULL::TEXT;
  ELSE
    RETURN QUERY SELECT FALSE, 'duplicate_same_hash'::TEXT;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.try_claim_seller_note_slot(BIGINT, UUID, TEXT, INTEGER, INTEGER) TO service_role;

CREATE OR REPLACE FUNCTION public.release_seller_note_slot(
  p_deal_id BIGINT,
  p_content_hash TEXT
)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.smartops_deal_note_locks
   WHERE deal_id = p_deal_id
     AND content_hash = p_content_hash;
$$;

GRANT EXECUTE ON FUNCTION public.release_seller_note_slot(BIGINT, TEXT) TO service_role;