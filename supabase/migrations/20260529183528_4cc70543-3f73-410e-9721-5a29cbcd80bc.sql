CREATE OR REPLACE FUNCTION public.fn_check_group_send_cooldown(
  p_group_jid text, p_node_index integer, p_campaign_id uuid
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH target AS (
    SELECT node_type, md5(coalesce(content_json::text,'')) AS content_hash
    FROM public.wa_message_queue
    WHERE campaign_id = p_campaign_id
      AND node_index  = p_node_index
      AND group_jid   = p_group_jid
    ORDER BY created_at DESC NULLS LAST
    LIMIT 1
  )
  SELECT NOT EXISTS (
    SELECT 1
    FROM public.wa_message_queue q, target t
    WHERE q.group_jid    = p_group_jid
      AND q.campaign_id  = p_campaign_id
      AND q.node_index   = p_node_index
      AND q.node_type    = t.node_type
      AND md5(coalesce(q.content_json::text,'')) = t.content_hash
      AND q.status       = 'sent'
      AND q.sent_at      > now() - interval '2 hours'
  );
$$;

UPDATE public.wa_message_queue
SET error_message = NULL, retry_count = 0
WHERE status = 'pending' AND error_message ILIKE '%SessionError%';