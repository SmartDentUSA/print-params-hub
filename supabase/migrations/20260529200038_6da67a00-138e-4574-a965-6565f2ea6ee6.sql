UPDATE wa_message_queue
SET 
  retry_count   = 0,
  error_message = null,
  scheduled_at  = now() + interval '20 seconds'
WHERE status = 'pending'
  AND group_jid IN (
    '120363407844899458@g.us',
    '120363402278959570@g.us'
  );