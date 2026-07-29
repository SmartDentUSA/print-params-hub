-- 1) lead_enrichment_audit -> field_enriched
CREATE OR REPLACE FUNCTION public.fn_log_enrichment_audit_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE r record;
BEGIN
  IF NEW.lead_id IS NULL THEN RETURN NEW; END IF;

  SELECT * INTO r FROM public.resolve_lead_identity(NEW.lead_id);

  INSERT INTO public.lead_activity_log (
    lead_id, person_id, company_id, event_type, event_timestamp, event_data,
    source_channel, identity_resolved_at
  ) VALUES (
    NEW.lead_id, r.person_id, r.company_id, 'field_enriched',
    COALESCE(NEW."timestamp", now()),
    jsonb_build_object(
      'field', COALESCE((NEW.fields_updated)[1], NULL),
      'fields_updated', to_jsonb(COALESCE(NEW.fields_updated, ARRAY[]::text[])),
      'previous', NEW.previous_values,
      'new', NEW.new_values,
      'source', NEW.source,
      'audit_id', NEW.id
    ),
    COALESCE(NEW.source, 'enrichment'), now()
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[fn_log_enrichment_audit_event] %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_enrichment_audit_event ON public.lead_enrichment_audit;
CREATE TRIGGER trg_log_enrichment_audit_event
AFTER INSERT ON public.lead_enrichment_audit
FOR EACH ROW EXECUTE FUNCTION public.fn_log_enrichment_audit_event();

-- 2) whatsapp_inbox (inbound) -> whatsapp_message_received
CREATE OR REPLACE FUNCTION public.fn_log_whatsapp_message_received()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r record;
  v_instance text;
  v_msg_id text;
  v_preview text;
BEGIN
  IF NEW.direction IS DISTINCT FROM 'inbound' OR NEW.lead_id IS NULL THEN RETURN NEW; END IF;

  SELECT * INTO r FROM public.resolve_lead_identity(NEW.lead_id);

  v_instance := COALESCE(
    NEW.raw_payload->>'instance',
    NEW.raw_payload->>'instanceName',
    NEW.raw_payload->'data'->>'instance',
    NEW.raw_payload->>'instance_name'
  );
  v_msg_id := COALESCE(
    NEW.raw_payload->'data'->'key'->>'id',
    NEW.raw_payload->'key'->>'id',
    NEW.raw_payload->>'messageId',
    NEW.raw_payload->>'message_id',
    NEW.id::text
  );
  v_preview := left(COALESCE(NULLIF(btrim(NEW.message_text), ''), '[media]'), 280);

  INSERT INTO public.lead_activity_log (
    lead_id, person_id, company_id, event_type, event_timestamp, event_data,
    source_channel, identity_resolved_at
  ) VALUES (
    NEW.lead_id, r.person_id, r.company_id, 'whatsapp_message_received',
    COALESCE(NEW.created_at, now()),
    jsonb_build_object(
      'instance', v_instance,
      'preview_texto', v_preview,
      'truncated', length(COALESCE(NEW.message_text, '')) > 280,
      'message_id', v_msg_id,
      'phone', NEW.phone_normalized,
      'media_type', NEW.media_type,
      'intent', NEW.intent_detected
    ),
    'whatsapp', now()
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[fn_log_whatsapp_message_received] %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_whatsapp_message_received ON public.whatsapp_inbox;
CREATE TRIGGER trg_log_whatsapp_message_received
AFTER INSERT ON public.whatsapp_inbox
FOR EACH ROW EXECUTE FUNCTION public.fn_log_whatsapp_message_received();

REVOKE EXECUTE ON FUNCTION public.fn_log_enrichment_audit_event() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_log_whatsapp_message_received() FROM PUBLIC, anon, authenticated;