-- Frente 1 — Ajuste 3: Lock hygiene
-- Trocar advisory lock por session-level + função explícita de release.

CREATE OR REPLACE FUNCTION public.try_lock_cognitive_analysis(target_lead_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pg_try_advisory_lock(hashtext(target_lead_id::text));
$$;

CREATE OR REPLACE FUNCTION public.release_cognitive_analysis_lock(target_lead_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pg_advisory_unlock(hashtext(target_lead_id::text));
$$;

REVOKE ALL ON FUNCTION public.try_lock_cognitive_analysis(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_cognitive_analysis_lock(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.try_lock_cognitive_analysis(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_cognitive_analysis_lock(UUID) TO service_role;