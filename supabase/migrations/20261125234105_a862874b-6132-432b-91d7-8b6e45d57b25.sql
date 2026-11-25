WITH candidates AS (
 SELECT DISTINCT ON(w.phone) w.id,w.phone,w.created_at
 FROM public.whatsapp_inbox w
 WHERE w.direction='inbound' AND w.instance_name LIKE 'zernio:%' AND w.created_at>='2026-11-18'
 AND (nullif(w.raw_payload->'metadata'->>'buttonPayload','') IS NOT NULL OR w.message_text ~* '(quero.*(inform|saber|falar)|gostaria.*(saber|conhecer)|tem resina|exoplan|preciso de ajuda)')
 AND EXISTS(SELECT 1 FROM public.campaign_send_log s WHERE s.provider='zernio_cloud_api' AND s.status='sent' AND s.sent_at<=w.created_at
 AND (regexp_replace(s.telefone,'\D','','g')=regexp_replace(w.phone,'\D','','g') OR (left(regexp_replace(s.telefone,'\D','','g'),4)=left(regexp_replace(w.phone,'\D','','g'),4) AND right(regexp_replace(s.telefone,'\D','','g'),8)=right(regexp_replace(w.phone,'\D','','g'),8))))
 ORDER BY w.phone,w.created_at DESC
)
INSERT INTO public.wa_campaign_reply_dispatch(inbox_id) SELECT id FROM candidates ON CONFLICT(inbox_id) DO NOTHING;