-- 1) Timeline dos checks de RMS
CREATE OR REPLACE FUNCTION public.fn_log_rms_unit_checks()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_unit TEXT := COALESCE(NULLIF(NEW.numero_rms,''), NULLIF(NEW.id_dongle,''), NEW.unit_index::TEXT);
BEGIN
  IF NEW.lead_id IS NULL THEN RETURN NEW; END IF;

  -- Pré-ativação
  IF (COALESCE(NEW.pre_ativacao_status,'') <> COALESCE(OLD.pre_ativacao_status,'')
      OR COALESCE(NEW.pre_ativacao_data::TEXT,'') <> COALESCE(OLD.pre_ativacao_data::TEXT,''))
     AND (NEW.pre_ativacao_status IS NOT NULL OR NEW.pre_ativacao_data IS NOT NULL) THEN
    INSERT INTO lead_activity_log (lead_id, event_type, event_timestamp, entity_type, entity_id, entity_name, source_channel, event_data, dedupe_hash)
    VALUES (NEW.lead_id, 'rms_pre_ativacao', COALESCE(NEW.pre_ativacao_data::timestamptz, now()), 'stripe_payment_unit', NEW.id::TEXT,
            'Pré-ativação RMS ' || v_unit, 'stripe_rms',
            jsonb_build_object('check','pre_ativacao','status',NEW.pre_ativacao_status,'data',NEW.pre_ativacao_data,
                               'numero_rms',NEW.numero_rms,'id_dongle',NEW.id_dongle,'produto',NEW.product_name),
            'rms_pre_' || NEW.id::TEXT || '_' || COALESCE(NEW.pre_ativacao_status,'') || COALESCE(NEW.pre_ativacao_data::TEXT,''))
    ON CONFLICT DO NOTHING;
  END IF;

  -- Ativação
  IF (COALESCE(NEW.ativacao_status,'') <> COALESCE(OLD.ativacao_status,'')
      OR COALESCE(NEW.ativacao_data::TEXT,'') <> COALESCE(OLD.ativacao_data::TEXT,''))
     AND (NEW.ativacao_status IS NOT NULL OR NEW.ativacao_data IS NOT NULL) THEN
    INSERT INTO lead_activity_log (lead_id, event_type, event_timestamp, entity_type, entity_id, entity_name, source_channel, event_data, dedupe_hash)
    VALUES (NEW.lead_id, 'rms_ativacao', COALESCE(NEW.ativacao_data::timestamptz, now()), 'stripe_payment_unit', NEW.id::TEXT,
            'Ativação RMS ' || v_unit, 'stripe_rms',
            jsonb_build_object('check','ativacao','status',NEW.ativacao_status,'data',NEW.ativacao_data,
                               'numero_rms',NEW.numero_rms,'id_dongle',NEW.id_dongle,'produto',NEW.product_name),
            'rms_ativ_' || NEW.id::TEXT || '_' || COALESCE(NEW.ativacao_status,'') || COALESCE(NEW.ativacao_data::TEXT,''))
    ON CONFLICT DO NOTHING;
  END IF;

  -- 1ª Mensalidade
  IF (COALESCE(NEW.mensalidade_status,'') <> COALESCE(OLD.mensalidade_status,'')
      OR COALESCE(NEW.mensalidade_data::TEXT,'') <> COALESCE(OLD.mensalidade_data::TEXT,''))
     AND (NEW.mensalidade_status IS NOT NULL OR NEW.mensalidade_data IS NOT NULL) THEN
    INSERT INTO lead_activity_log (lead_id, event_type, event_timestamp, entity_type, entity_id, entity_name, source_channel, event_data, dedupe_hash)
    VALUES (NEW.lead_id, 'rms_mensalidade', COALESCE(NEW.mensalidade_data::timestamptz, now()), 'stripe_payment_unit', NEW.id::TEXT,
            '1ª Mensalidade RMS ' || v_unit, 'stripe_rms',
            jsonb_build_object('check','mensalidade','status',NEW.mensalidade_status,'data',NEW.mensalidade_data,
                               'numero_rms',NEW.numero_rms,'id_dongle',NEW.id_dongle,'produto',NEW.product_name),
            'rms_mens_' || NEW.id::TEXT || '_' || COALESCE(NEW.mensalidade_status,'') || COALESCE(NEW.mensalidade_data::TEXT,''))
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_rms_unit_checks ON public.stripe_payment_units;
CREATE TRIGGER trg_log_rms_unit_checks
AFTER INSERT OR UPDATE OF pre_ativacao_status, pre_ativacao_data, ativacao_status, ativacao_data, mensalidade_status, mensalidade_data
ON public.stripe_payment_units
FOR EACH ROW EXECUTE FUNCTION public.fn_log_rms_unit_checks();

-- Backfill dos checks já existentes
INSERT INTO lead_activity_log (lead_id, event_type, event_timestamp, entity_type, entity_id, entity_name, source_channel, event_data, dedupe_hash)
SELECT u.lead_id, k.event_type, COALESCE(k.dt::timestamptz, u.paid_at, u.created_at), 'stripe_payment_unit', u.id::TEXT,
       k.label || ' RMS ' || COALESCE(NULLIF(u.numero_rms,''), NULLIF(u.id_dongle,''), u.unit_index::TEXT), 'stripe_rms',
       jsonb_build_object('check', k.check_name, 'status', k.status, 'data', k.dt,
                          'numero_rms', u.numero_rms, 'id_dongle', u.id_dongle, 'produto', u.product_name),
       k.prefix || u.id::TEXT || '_' || COALESCE(k.status,'') || COALESCE(k.dt::TEXT,'')
FROM stripe_payment_units u
CROSS JOIN LATERAL (
  VALUES
    ('rms_pre_ativacao','Pré-ativação','pre_ativacao','rms_pre_', u.pre_ativacao_status, u.pre_ativacao_data),
    ('rms_ativacao','Ativação','ativacao','rms_ativ_', u.ativacao_status, u.ativacao_data),
    ('rms_mensalidade','1ª Mensalidade','mensalidade','rms_mens_', u.mensalidade_status, u.mensalidade_data)
) AS k(event_type, label, check_name, prefix, status, dt)
WHERE u.lead_id IS NOT NULL AND (k.status IS NOT NULL OR k.dt IS NOT NULL)
ON CONFLICT DO NOTHING;

-- 2) Briefing do vendedor: guarda de 24h só sobre briefings realmente enviados
CREATE OR REPLACE FUNCTION public.fn_trigger_seller_briefing()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url         TEXT := 'https://okeogjgqijbfkudfjadz.supabase.co/functions/v1';
  v_old_piperun TEXT := CASE WHEN TG_OP = 'UPDATE' THEN OLD.piperun_id ELSE NULL END;
  v_ja_enviou   int;
BEGIN
  IF NOT (
    NEW.piperun_id IS NOT NULL
    AND NEW.proprietario_lead_crm IS NOT NULL
    AND LENGTH(NEW.proprietario_lead_crm) > 3
    AND NEW.proprietario_lead_crm NOT LIKE '%@%'
    AND (TG_OP = 'INSERT' OR v_old_piperun IS NULL)
  ) THEN RETURN NEW; END IF;

  IF NEW.created_at < NOW() - INTERVAL '3 days' THEN RETURN NEW; END IF;

  IF NEW.automation_cooldown_until IS NOT NULL
     AND NEW.automation_cooldown_until > NOW() THEN RETURN NEW; END IF;

  -- Só briefings efetivamente enviados/errados bloqueiam. Placeholders "pendente"
  -- e outras automações (boas-vindas) não podem cancelar o briefing.
  SELECT COUNT(*) INTO v_ja_enviou
  FROM message_logs
  WHERE lead_id = NEW.id
    AND tipo IN ('briefing_vendedor','briefing_vendedor_block')
    AND status IN ('enviado','erro')
    AND data_envio > NOW() - INTERVAL '24 hours';

  IF v_ja_enviou > 0 THEN RETURN NEW; END IF;

  PERFORM net.http_post(
    url     := v_url || '/smart-ops-lia-notify-seller',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body    := jsonb_build_object('lead_id', NEW.id::text, 'seller_name', NEW.proprietario_lead_crm, 'trigger', 'db_trigger')
  );

  IF NEW.telefone_normalized IS NOT NULL
     AND LOWER(COALESCE(NEW.piperun_pipeline_name,'')) = 'funil de vendas'
     AND LOWER(COALESCE(NEW.piperun_stage_name,'')) = 'sem contato'
  THEN
    PERFORM net.http_post(
      url     := v_url || '/smart-ops-lead-welcome',
      headers := '{"Content-Type":"application/json"}'::jsonb,
      body    := jsonb_build_object('lead_id', NEW.id::text)
    );
  END IF;

  RETURN NEW;
END;
$$;