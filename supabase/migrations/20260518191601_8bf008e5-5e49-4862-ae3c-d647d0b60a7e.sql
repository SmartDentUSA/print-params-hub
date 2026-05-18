-- Frente 1 — Ajuste 3 (revisão): row-based TTL lock (PostgREST/pgBouncer-safe)
-- Advisory locks ficam atrelados à sessão Postgres, que não sobrevive ao pool do PostgREST.
-- Substituímos por linha com TTL de 30s.

CREATE TABLE IF NOT EXISTS public.cognitive_lead_locks (
  lead_id UUID PRIMARY KEY,
  locked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ttl_seconds INT NOT NULL DEFAULT 30
);

ALTER TABLE public.cognitive_lead_locks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_only_cognitive_locks"
  ON public.cognitive_lead_locks
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.try_lock_cognitive_analysis(target_lead_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW();
BEGIN
  -- Insere se livre; reaproveita se expirado. Retorna true se adquirido.
  INSERT INTO public.cognitive_lead_locks(lead_id, locked_at)
  VALUES (target_lead_id, v_now)
  ON CONFLICT (lead_id) DO UPDATE
    SET locked_at = v_now
    WHERE public.cognitive_lead_locks.locked_at
        < v_now - (public.cognitive_lead_locks.ttl_seconds || ' seconds')::interval;

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_cognitive_analysis_lock(target_lead_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.cognitive_lead_locks WHERE lead_id = target_lead_id;
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.try_lock_cognitive_analysis(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_cognitive_analysis_lock(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.try_lock_cognitive_analysis(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_cognitive_analysis_lock(UUID) TO service_role;

-- Cron de limpeza preventiva (locks órfãos > 5 minutos)
CREATE OR REPLACE FUNCTION public.cleanup_orphan_cognitive_locks()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INT;
BEGIN
  WITH del AS (
    DELETE FROM public.cognitive_lead_locks
    WHERE locked_at < NOW() - INTERVAL '5 minutes'
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_deleted FROM del;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_orphan_cognitive_locks() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_orphan_cognitive_locks() TO service_role;