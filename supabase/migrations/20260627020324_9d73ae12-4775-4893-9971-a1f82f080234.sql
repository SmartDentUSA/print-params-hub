-- Index to allow fast active-lock-by-person checks
CREATE INDEX IF NOT EXISTS idx_golden_rule_locks_person_active
  ON public.smartops_golden_rule_deal_locks (person_id, expires_at);

CREATE OR REPLACE FUNCTION public.try_claim_deal_create_slot(
  _lead_id uuid,
  _person_id bigint,
  _intent_hash text,
  _ttl_seconds int DEFAULT 300
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted boolean := false;
  v_person_lock_held boolean := false;
BEGIN
  -- Person-level guard: if ANOTHER lead currently holds an active lock for
  -- this same PipeRun Person, refuse. Prevents two CDP rows pointing to the
  -- same Person from racing to createNewDeal in parallel.
  IF _person_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.smartops_golden_rule_deal_locks
      WHERE person_id = _person_id
        AND lead_id <> _lead_id
        AND expires_at > now()
    ) INTO v_person_lock_held;

    IF v_person_lock_held THEN
      RETURN false;
    END IF;
  END IF;

  INSERT INTO public.smartops_golden_rule_deal_locks (lead_id, person_id, intent_hash, expires_at)
  VALUES (_lead_id, _person_id, _intent_hash, now() + make_interval(secs => _ttl_seconds))
  ON CONFLICT (lead_id) DO UPDATE
    SET acquired_at = now(),
        expires_at  = now() + make_interval(secs => _ttl_seconds),
        person_id   = EXCLUDED.person_id,
        intent_hash = EXCLUDED.intent_hash
    WHERE public.smartops_golden_rule_deal_locks.expires_at < now()
  RETURNING true INTO v_inserted;

  RETURN COALESCE(v_inserted, false);
END;
$$;

REVOKE ALL ON FUNCTION public.try_claim_deal_create_slot(uuid, bigint, text, int) FROM public;
GRANT EXECUTE ON FUNCTION public.try_claim_deal_create_slot(uuid, bigint, text, int) TO service_role;