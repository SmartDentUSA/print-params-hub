CREATE OR REPLACE FUNCTION public.claim_pending_wa_messages(p_limit int DEFAULT 5)
RETURNS SETOF public.wa_message_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.wa_message_queue q
     SET status = 'sending'
   WHERE q.id IN (
     SELECT id
       FROM public.wa_message_queue
      WHERE status = 'pending'
        AND scheduled_at <= now()
      ORDER BY scheduled_at ASC
      LIMIT p_limit
      FOR UPDATE SKIP LOCKED
   )
  RETURNING q.*;
END$$;

GRANT EXECUTE ON FUNCTION public.claim_pending_wa_messages(int) TO service_role;