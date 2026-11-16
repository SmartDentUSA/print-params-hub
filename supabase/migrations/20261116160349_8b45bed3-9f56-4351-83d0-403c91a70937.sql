-- Ordem estrita nas campanhas de fluxo: um item por campanha+grupo em andamento,
-- e nenhum item sai antes dos de sequence_no menor terminarem.
ALTER TABLE public.wa_message_queue ADD COLUMN IF NOT EXISTS claimed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_wa_send_log_queue_id ON public.wa_send_log (queue_id);
CREATE INDEX IF NOT EXISTS idx_wa_queue_sending_claimed ON public.wa_message_queue (claimed_at) WHERE status = 'sending';

CREATE OR REPLACE FUNCTION public.claim_pending_wa_messages(p_limit integer DEFAULT 5)
 RETURNS SETOF wa_message_queue
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Serializa reservas concorrentes do cron: cada execução enxerga as reservas
  -- já confirmadas pelas anteriores, então duas execuções nunca pegam itens
  -- da mesma campanha+grupo ao mesmo tempo.
  PERFORM pg_advisory_xact_lock(hashtext('claim_pending_wa_messages'));

  RETURN QUERY
  UPDATE public.wa_message_queue q
     SET status = 'sending',
         claimed_at = now()
   WHERE q.id IN (
     SELECT q2.id
       FROM public.wa_message_queue q2
       LEFT JOIN public.wa_campaigns c ON c.id = q2.campaign_id
      WHERE q2.status = 'pending'
        AND q2.scheduled_at <= now()
        AND (q2.campaign_id IS NULL OR c.status = 'active')
        AND (
          -- blasts e envios avulsos seguem como antes
          q2.campaign_id IS NULL
          OR COALESCE(c.campaign_type, 'flow') <> 'flow'
          -- fluxo: nada em envio no mesmo grupo e nada pendente com sequência menor
          -- (pendentes ainda no futuro também bloqueiam)
          OR NOT EXISTS (
            SELECT 1
              FROM public.wa_message_queue p
             WHERE p.campaign_id = q2.campaign_id
               AND p.group_jid IS NOT DISTINCT FROM q2.group_jid
               AND p.id <> q2.id
               AND (
                 p.status = 'sending'
                 OR (p.status = 'pending'
                     AND COALESCE(p.sequence_no, p.node_index) < COALESCE(q2.sequence_no, q2.node_index))
               )
          )
        )
      ORDER BY q2.scheduled_at ASC, q2.sequence_no ASC NULLS LAST, q2.node_index ASC NULLS LAST, q2.created_at ASC
      LIMIT p_limit
      FOR UPDATE OF q2 SKIP LOCKED
   )
  RETURNING q.*;
END$function$;