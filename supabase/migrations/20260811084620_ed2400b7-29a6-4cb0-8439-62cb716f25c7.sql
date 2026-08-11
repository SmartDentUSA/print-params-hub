CREATE TABLE IF NOT EXISTS public.smartops_automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL DEFAULT 'Nova automação',
  descricao text,
  ativo boolean NOT NULL DEFAULT false,
  canal text NOT NULL DEFAULT 'whatsapp',
  quando text NOT NULL DEFAULT 'etapa_alterada',
  gate_pipeline_id text,
  gate_pipeline_name text,
  gate_stage_ids text[] NOT NULL DEFAULT '{}',
  gate_stage_names text[] NOT NULL DEFAULT '{}',
  sender_instance text NOT NULL DEFAULT 'smartdent_marketing',
  destinatario text NOT NULL DEFAULT 'lead',
  destino_numero text,
  delay_minutos integer NOT NULL DEFAULT 0,
  horario_inicio time NOT NULL DEFAULT '08:00',
  horario_fim time NOT NULL DEFAULT '20:00',
  mensagem_template text,
  mensagem_fora_horario text,
  cooldown_horas integer NOT NULL DEFAULT 24,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.smartops_automations TO authenticated;
GRANT ALL ON public.smartops_automations TO service_role;

ALTER TABLE public.smartops_automations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can manage smartops automations" ON public.smartops_automations;
CREATE POLICY "Authenticated can manage smartops automations"
ON public.smartops_automations FOR ALL TO authenticated
USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.smartops_automation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_uid text NOT NULL UNIQUE DEFAULT ('SOA-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))),
  automation_id uuid NOT NULL REFERENCES public.smartops_automations(id) ON DELETE CASCADE,
  automation_nome text,
  lead_id uuid,
  deal_id text,
  canal text NOT NULL DEFAULT 'whatsapp',
  destino text,
  destinatario_tipo text,
  sender_instance text,
  status text NOT NULL DEFAULT 'enviado',
  mensagem_preview text,
  provider_message_id text,
  error_details text,
  created_at timestamptz NOT NULL DEFAULT now(),
  run_date date NOT NULL DEFAULT ((now() AT TIME ZONE 'America/Sao_Paulo')::date)
);

GRANT SELECT ON public.smartops_automation_runs TO authenticated;
GRANT ALL ON public.smartops_automation_runs TO service_role;

ALTER TABLE public.smartops_automation_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view smartops automation runs" ON public.smartops_automation_runs;
CREATE POLICY "Authenticated can view smartops automation runs"
ON public.smartops_automation_runs FOR SELECT TO authenticated
USING (true);

CREATE UNIQUE INDEX IF NOT EXISTS smartops_automation_runs_daily_uq
  ON public.smartops_automation_runs (automation_id, lead_id, run_date)
  WHERE lead_id IS NOT NULL AND status <> 'erro';

CREATE INDEX IF NOT EXISTS smartops_automation_runs_lead_idx
  ON public.smartops_automation_runs (lead_id, created_at DESC);

DROP TRIGGER IF EXISTS trg_smartops_automations_updated_at ON public.smartops_automations;
CREATE TRIGGER trg_smartops_automations_updated_at
BEFORE UPDATE ON public.smartops_automations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Todo envio de automação entra na Timeline do Lead com o identificador único
CREATE OR REPLACE FUNCTION public.fn_log_automation_run_to_timeline()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.lead_id IS NULL THEN
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
AFTER INSERT ON public.smartops_automation_runs
FOR EACH ROW EXECUTE FUNCTION public.fn_log_automation_run_to_timeline();