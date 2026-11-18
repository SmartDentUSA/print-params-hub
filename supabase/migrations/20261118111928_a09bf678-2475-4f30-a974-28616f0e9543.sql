CREATE OR REPLACE FUNCTION public.fn_log_wa_official_sair()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_lead uuid;
  v_digits text;
BEGIN
  IF NEW.direction IS DISTINCT FROM 'inbound'
     OR coalesce(NEW.instance_name, '') NOT LIKE 'zernio:%'
     OR coalesce(NEW.is_group, false)
     OR lower(regexp_replace(coalesce(NEW.message_text, ''), '[^[:alpha:]]', '', 'g')) <> 'sair' THEN
    RETURN NEW;
  END IF;

  v_lead := NEW.lead_id;
  IF v_lead IS NULL THEN
    v_digits := regexp_replace(coalesce(NEW.phone_normalized, NEW.phone, ''), '\D', '', 'g');
    IF v_digits <> '' THEN
      SELECT id INTO v_lead FROM public.lia_attendances
       WHERE merged_into IS NULL AND telefone_normalized = '+' || v_digits
       ORDER BY updated_at DESC NULLS LAST LIMIT 1;
    END IF;
  END IF;
  IF v_lead IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.lead_activity_log
    (lead_id, event_type, event_timestamp, event_data, entity_type, entity_id, entity_name, source_channel, dedupe_hash)
  VALUES
    (v_lead, 'whatsapp_oficial_sair', coalesce(NEW.created_at, now()),
     jsonb_build_object(
       'kind_label', 'Respondeu SAIR (WhatsApp Oficial)',
       'mensagem', NEW.message_text,
       'telefone', NEW.phone,
       'conta', NEW.instance_name,
       'wa_message_id', NEW.wa_message_id,
       'inbox_id', NEW.id,
       'remove_da_lista', false
     ),
     'whatsapp_inbox', NEW.id::text, 'Respondeu SAIR (WhatsApp Oficial)', 'whatsapp_oficial',
     'wa_inbox:' || NEW.id::text)
  ON CONFLICT (lead_id, event_type, dedupe_hash) WHERE dedupe_hash IS NOT NULL DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'fn_log_wa_official_sair: %', SQLERRM;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_log_wa_official_sair() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_log_wa_official_sair ON public.whatsapp_inbox;
CREATE TRIGGER trg_log_wa_official_sair
AFTER INSERT OR UPDATE OF lead_id ON public.whatsapp_inbox
FOR EACH ROW EXECUTE FUNCTION public.fn_log_wa_official_sair();