CREATE TABLE public.trigger_automations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT false,
  prioridade INTEGER NOT NULL DEFAULT 100,
  -- email | instagram | tiktok | facebook | whatsapp
  trigger_source TEXT NOT NULL DEFAULT 'email',
  -- opened | clicked | replied | message_received
  trigger_event TEXT NOT NULL DEFAULT 'opened',
  -- provider (evolution|zernio), team_member_ids, instance_names, account_ids, keywords, campaign_ids
  trigger_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  action_type TEXT NOT NULL DEFAULT 'whatsapp',
  action_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  instance_name TEXT,
  horario_inicio INTEGER NOT NULL DEFAULT 9,
  horario_fim INTEGER NOT NULL DEFAULT 18,
  dias_semana INTEGER[] NOT NULL DEFAULT ARRAY[1,2,3,4,5],
  delay_minutos INTEGER NOT NULL DEFAULT 0,
  cooldown_horas INTEGER NOT NULL DEFAULT 24,
  dedupe_window_minutes INTEGER NOT NULL DEFAULT 1440,
  max_por_dia INTEGER NOT NULL DEFAULT 200,
  last_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trigger_automations TO authenticated;
GRANT ALL ON public.trigger_automations TO service_role;

ALTER TABLE public.trigger_automations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated manage trigger automations"
ON public.trigger_automations FOR ALL TO authenticated
USING (true) WITH CHECK (true);

CREATE TABLE public.trigger_automation_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  automation_id UUID NOT NULL REFERENCES public.trigger_automations(id) ON DELETE CASCADE,
  lead_id UUID,
  channel TEXT NOT NULL,
  destino TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  prioridade INTEGER NOT NULL DEFAULT 100,
  trigger_ref TEXT NOT NULL,
  trigger_detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  dedupe_hash TEXT NOT NULL,
  rendered_message TEXT,
  rendered_subject TEXT,
  short_link_url TEXT,
  provider_message_id TEXT,
  error_message TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT trigger_automation_queue_ref_unique UNIQUE (automation_id, trigger_ref)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trigger_automation_queue TO authenticated;
GRANT ALL ON public.trigger_automation_queue TO service_role;

ALTER TABLE public.trigger_automation_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated manage trigger automation queue"
ON public.trigger_automation_queue FOR ALL TO authenticated
USING (true) WITH CHECK (true);

CREATE INDEX idx_taq_status_sched ON public.trigger_automation_queue (status, scheduled_at);
CREATE INDEX idx_taq_automation ON public.trigger_automation_queue (automation_id, created_at DESC);
CREATE INDEX idx_taq_lead ON public.trigger_automation_queue (lead_id, created_at DESC);
CREATE INDEX idx_taq_dedupe ON public.trigger_automation_queue (dedupe_hash, created_at DESC);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_trigger_automations_updated_at
BEFORE UPDATE ON public.trigger_automations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_trigger_automation_queue_updated_at
BEFORE UPDATE ON public.trigger_automation_queue
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.try_claim_trigger_automation_send(
  _automation_id UUID,
  _lead_id UUID,
  _channel TEXT,
  _destino TEXT,
  _trigger_ref TEXT,
  _dedupe_hash TEXT,
  _scheduled_at TIMESTAMPTZ DEFAULT now(),
  _prioridade INTEGER DEFAULT 100,
  _window_minutes INTEGER DEFAULT 1440,
  _rendered_message TEXT DEFAULT NULL,
  _rendered_subject TEXT DEFAULT NULL,
  _short_link_url TEXT DEFAULT NULL,
  _trigger_detail JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _existing UUID;
  _new_id UUID;
BEGIN
  IF _dedupe_hash IS NULL OR _dedupe_hash = '' THEN
    RETURN NULL;
  END IF;

  SELECT id INTO _existing
  FROM public.trigger_automation_queue
  WHERE dedupe_hash = _dedupe_hash
    AND status <> 'failed'
    AND created_at > now() - make_interval(mins => GREATEST(COALESCE(_window_minutes, 1440), 1))
  LIMIT 1;

  IF _existing IS NOT NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.trigger_automation_queue (
    automation_id, lead_id, channel, destino, trigger_ref, dedupe_hash,
    scheduled_at, prioridade, rendered_message, rendered_subject,
    short_link_url, trigger_detail
  ) VALUES (
    _automation_id, _lead_id, _channel, _destino, _trigger_ref, _dedupe_hash,
    COALESCE(_scheduled_at, now()), COALESCE(_prioridade, 100), _rendered_message,
    _rendered_subject, _short_link_url, COALESCE(_trigger_detail, '{}'::jsonb)
  )
  ON CONFLICT (automation_id, trigger_ref) DO NOTHING
  RETURNING id INTO _new_id;

  RETURN _new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.try_claim_trigger_automation_send(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, INTEGER, INTEGER, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.try_claim_trigger_automation_send(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, INTEGER, INTEGER, TEXT, TEXT, TEXT, JSONB) TO service_role;