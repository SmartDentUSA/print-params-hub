CREATE OR REPLACE FUNCTION public.fn_log_automation_run_to_timeline()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.lead_id IS NULL OR NEW.status = 'pendente' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.lead_activity_log (
    lead_id, event_type, event_timestamp, source_channel,
    entity_type, entity_id, entity_name, event_data, dedupe_hash
  ) VALUES (
    NEW.lead_id,
    CASE WHEN NEW.status = 'erro' THEN 'automation_failed' ELSE 'automation_sent' END,
    NEW.created_at,
    NEW.canal,
    'smartops_automation',
    NEW.run_uid,
    COALESCE(NEW.automation_nome, 'Automação SmartOps'),
    jsonb_build_object(
      'run_uid', NEW.run_uid,
      'automation_id', NEW.automation_id,
      'automation_nome', NEW.automation_nome,
      'canal', NEW.canal,
      'destino', NEW.destino,
      'destinatario_tipo', NEW.destinatario_tipo,
      'sender_instance', NEW.sender_instance,
      'status', NEW.status,
      'mensagem', NEW.mensagem_preview,
      'provider_message_id', NEW.provider_message_id,
      'error_details', NEW.error_details
    ),
    'soa:' || NEW.run_uid
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_automation_run_to_timeline ON public.smartops_automation_runs;
CREATE TRIGGER trg_log_automation_run_to_timeline
AFTER INSERT OR UPDATE OF status ON public.smartops_automation_runs
FOR EACH ROW EXECUTE FUNCTION public.fn_log_automation_run_to_timeline();