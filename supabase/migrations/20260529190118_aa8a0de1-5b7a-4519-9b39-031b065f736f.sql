
-- Watchdog: rastreamento de entrega real e anti-duplicação
ALTER TABLE public.wa_message_queue
  ADD COLUMN IF NOT EXISTS delivery_status text DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS delivery_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivery_attempts int NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_wa_queue_delivery_pending
  ON public.wa_message_queue (sent_at)
  WHERE sent_at IS NOT NULL
    AND delivery_status IN ('unknown','sent_to_server');

-- RPC: reprocessa itens não-entregues de uma campanha (reset para reenvio controlado)
CREATE OR REPLACE FUNCTION public.fn_wa_reprocess_undelivered(p_campaign_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count int;
BEGIN
  UPDATE public.wa_message_queue
     SET status         = 'pending',
         retry_count    = 0,
         scheduled_at   = now(),
         error_message  = NULL
   WHERE campaign_id = p_campaign_id
     AND (delivery_status = 'failed_undelivered' OR status = 'failed');
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_wa_reprocess_undelivered(uuid) TO authenticated, service_role;

-- View agregada de saúde por campanha (para o painel)
CREATE OR REPLACE VIEW public.v_wa_campaign_delivery_health AS
SELECT
  campaign_id,
  COUNT(*) FILTER (WHERE status = 'pending')                                       AS scheduled,
  COUNT(*) FILTER (WHERE status = 'sent')                                          AS sent,
  COUNT(*) FILTER (WHERE delivery_status IN ('delivered','read'))                  AS delivered,
  COUNT(*) FILTER (WHERE delivery_status = 'read')                                 AS read,
  COUNT(*) FILTER (WHERE status = 'failed' OR delivery_status = 'failed_undelivered') AS failed,
  COUNT(*) FILTER (WHERE delivery_status = 'sent_to_server'
                   AND sent_at < now() - interval '10 minutes'
                   AND delivery_status NOT IN ('delivered','read'))                AS stuck,
  MAX(sent_at)        AS last_sent_at,
  MAX(scheduled_at)   AS next_scheduled_at
FROM public.wa_message_queue
GROUP BY campaign_id;

GRANT SELECT ON public.v_wa_campaign_delivery_health TO authenticated, service_role;
