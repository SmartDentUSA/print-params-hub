-- Trava atômica para criação de Deals VENDAS (defense-in-depth Regra de Ouro)
CREATE TABLE IF NOT EXISTS public.smartops_golden_rule_deal_locks (
  lead_id uuid PRIMARY KEY,
  acquired_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  person_id bigint,
  intent_hash text
);

GRANT ALL ON public.smartops_golden_rule_deal_locks TO service_role;
ALTER TABLE public.smartops_golden_rule_deal_locks ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_golden_rule_locks_expires
  ON public.smartops_golden_rule_deal_locks (expires_at);

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
BEGIN
  INSERT INTO public.smartops_golden_rule_deal_locks (lead_id, person_id, intent_hash, expires_at)
  VALUES (_lead_id, _person_id, _intent_hash, now() + make_interval(secs => _ttl_seconds))
  ON CONFLICT (lead_id) DO UPDATE
    SET acquired_at = now(),
        expires_at = now() + make_interval(secs => _ttl_seconds),
        person_id  = EXCLUDED.person_id,
        intent_hash = EXCLUDED.intent_hash
    WHERE public.smartops_golden_rule_deal_locks.expires_at < now()
  RETURNING true INTO v_inserted;

  RETURN COALESCE(v_inserted, false);
END;
$$;

CREATE OR REPLACE FUNCTION public.release_deal_create_slot(_lead_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.smartops_golden_rule_deal_locks WHERE lead_id = _lead_id;
$$;

REVOKE ALL ON FUNCTION public.try_claim_deal_create_slot(uuid, bigint, text, int) FROM public;
REVOKE ALL ON FUNCTION public.release_deal_create_slot(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.try_claim_deal_create_slot(uuid, bigint, text, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_deal_create_slot(uuid) TO service_role;