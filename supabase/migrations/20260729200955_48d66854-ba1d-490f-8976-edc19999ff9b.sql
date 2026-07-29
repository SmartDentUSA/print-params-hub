DROP INDEX IF EXISTS public.whatsapp_inbox_instance_msg_uidx;

DELETE FROM public.whatsapp_inbox a
USING public.whatsapp_inbox b
WHERE a.ctid > b.ctid
  AND a.instance_name IS NOT NULL AND a.wa_message_id IS NOT NULL
  AND a.instance_name = b.instance_name AND a.wa_message_id = b.wa_message_id;

CREATE UNIQUE INDEX whatsapp_inbox_instance_msg_uidx
  ON public.whatsapp_inbox (instance_name, wa_message_id);
