
CREATE OR REPLACE FUNCTION public.claim_pending_wa_messages(p_limit integer DEFAULT 5)
RETURNS SETOF public.wa_message_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  UPDATE public.wa_message_queue q
     SET status = 'sending'
   WHERE q.id IN (
     SELECT q2.id
       FROM public.wa_message_queue q2
      WHERE q2.status = 'pending'
        AND q2.scheduled_at <= now()
        AND (
          q2.campaign_id IS NULL
          OR EXISTS (
            SELECT 1 FROM public.wa_campaigns c
             WHERE c.id = q2.campaign_id AND c.status = 'active'
          )
        )
      ORDER BY q2.scheduled_at ASC
      LIMIT p_limit
      FOR UPDATE SKIP LOCKED
   )
  RETURNING q.*;
END$function$;
