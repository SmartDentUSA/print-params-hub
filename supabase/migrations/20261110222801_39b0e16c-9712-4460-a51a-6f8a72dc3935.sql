CREATE TABLE IF NOT EXISTS public.cognitive_dispatch_state (
  lead_id uuid PRIMARY KEY,
  dispatched_at timestamptz NOT NULL DEFAULT now(),
  last_event_type text
);
GRANT ALL ON public.cognitive_dispatch_state TO service_role;
ALTER TABLE public.cognitive_dispatch_state ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.fn_dispatch_cognitive_on_timeline()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead uuid;
  v_key text;
BEGIN
  IF NEW.lead_id IS NULL OR NOT (NEW.event_type = ANY (ARRAY[
      'crm_activity','crm_proposal','crm_deal_won','crm_deal_lost','crm_deal_created','deal_created',
      'form_submission','meta_ads_lead_entry','whatsapp_message_received','social_dm_received',
      'ecommerce_order_created','ecommerce_order_paid','ecommerce_order_invoiced',
      'reuniao_agendada','reuniao_analisada','crm_etapa_movida_reuniao',
      'deal_reativado_via_formulario','deal_reconversion_created','certificado_emitido',
      'support_ticket_created','support_ticket_resolved'
    ]::text[])) THEN
    RETURN NEW;
  END IF;

  -- Uma chamada a cada 15s por lead; a função espera 20s antes de ler, então a rajada inteira entra.
  INSERT INTO public.cognitive_dispatch_state AS s (lead_id, dispatched_at, last_event_type)
  VALUES (NEW.lead_id, now(), NEW.event_type)
  ON CONFLICT (lead_id) DO UPDATE
    SET dispatched_at = now(), last_event_type = EXCLUDED.last_event_type
    WHERE s.dispatched_at < now() - interval '15 seconds'
  RETURNING s.lead_id INTO v_lead;

  IF v_lead IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1;

  PERFORM net.http_post(
    url := 'https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/cognitive-lead-analysis',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || coalesce(v_key, '')),
    body := jsonb_build_object('leadId', NEW.lead_id, 'trigger', 'timeline', 'async', true, 'delay_ms', 20000, 'event_type', NEW.event_type)
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Nunca bloqueia o registro da interação.
  RAISE WARNING 'fn_dispatch_cognitive_on_timeline: %', SQLERRM;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_dispatch_cognitive_on_timeline() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_dispatch_cognitive_on_timeline ON public.lead_activity_log;
CREATE TRIGGER trg_dispatch_cognitive_on_timeline
AFTER INSERT ON public.lead_activity_log
FOR EACH ROW EXECUTE FUNCTION public.fn_dispatch_cognitive_on_timeline();

DROP FUNCTION IF EXISTS public.fn_cognitive_timeline_candidates(integer);