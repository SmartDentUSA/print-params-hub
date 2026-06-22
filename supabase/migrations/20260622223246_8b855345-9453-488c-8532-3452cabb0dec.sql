CREATE OR REPLACE FUNCTION public.claim_scheduled_broadcasts(p_limit int DEFAULT 5)
RETURNS TABLE(id uuid)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.social_broadcasts sb
     SET status = 'dispatching'
   WHERE sb.id IN (
     SELECT s.id FROM public.social_broadcasts s
      WHERE s.status = 'scheduled'
        AND s.scheduled_at <= now()
      ORDER BY s.scheduled_at
      LIMIT p_limit
      FOR UPDATE SKIP LOCKED
   )
  RETURNING sb.id;
$$;

REVOKE ALL ON FUNCTION public.claim_scheduled_broadcasts(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_scheduled_broadcasts(int) TO service_role;