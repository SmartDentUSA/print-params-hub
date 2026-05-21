CREATE OR REPLACE FUNCTION public.fn_log_form_submission_to_timeline()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_source_channel text;
  v_form_name text;
  v_entity_id text;
  v_recent_exists boolean;
BEGIN
  -- Só loga quando form_name é preenchido (indica submissão real)
  IF NEW.form_name IS NOT NULL AND (
    TG_OP = 'INSERT' OR 
    (TG_OP = 'UPDATE' AND OLD.form_name IS DISTINCT FROM NEW.form_name)
  ) THEN
    v_form_name := NEW.form_name;
    v_source_channel := COALESCE(NEW.source, 'sistema');
    v_entity_id := COALESCE(
      NULLIF(NEW.platform_lead_id, ''),
      NULLIF(NEW.raw_payload->'latest_payload'->>'meta_leadgen_id', ''),
      NULLIF(NEW.raw_payload->'latest_payload'->>'platform_lead_id', ''),
      'lead:' || NEW.id::text || '|source:' || v_source_channel || '|form:' || v_form_name
    );

    -- Guard contra reentrega/oscilações Meta: mesmo lead + fonte + formulário em 24h
    SELECT EXISTS (
      SELECT 1
      FROM public.lead_activity_log lal
      WHERE lal.lead_id = NEW.id
        AND lal.event_type = 'form_submission'
        AND COALESCE(lal.source_channel, 'sistema') = v_source_channel
        AND COALESCE(lal.event_data->>'form_name', lal.entity_name, '') = v_form_name
        AND lal.event_timestamp >= now() - interval '24 hours'
      LIMIT 1
    ) INTO v_recent_exists;

    IF NOT v_recent_exists THEN
      INSERT INTO public.lead_activity_log (
        lead_id,
        event_type,
        entity_type,
        entity_id,
        entity_name,
        event_data,
        source_channel,
        event_timestamp
      ) VALUES (
        NEW.id,
        'form_submission',
        'form',
        v_entity_id,
        v_form_name,
        jsonb_build_object(
          'form_name',         NEW.form_name,
          'source',            NEW.source,
          'produto_interesse', NEW.produto_interesse,
          'area_atuacao',      NEW.area_atuacao,
          'email',             NEW.email,
          'telefone',          NEW.telefone_normalized,
          'origem_campanha',   NEW.origem_campanha,
          'piperun_link',      NEW.piperun_link,
          'dedupe_key',        v_entity_id
        ),
        v_source_channel,
        now()
      )
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  -- Loga quando deal é criado (piperun_id preenchido pela primeira vez)
  IF TG_OP = 'UPDATE' 
     AND OLD.piperun_id IS NULL 
     AND NEW.piperun_id IS NOT NULL THEN
    INSERT INTO public.lead_activity_log (
      lead_id,
      event_type,
      entity_type,
      entity_name,
      event_data,
      source_channel,
      event_timestamp
    ) VALUES (
      NEW.id,
      'deal_created',
      'deal',
      COALESCE(NEW.form_name, 'Novo Deal'),
      jsonb_build_object(
        'piperun_id',   NEW.piperun_id,
        'piperun_link', NEW.piperun_link,
        'vendedor',     NEW.proprietario_lead_crm
      ),
      'piperun',
      now()
    )
    ON CONFLICT DO NOTHING;
  END IF;

  -- Loga quando vendedor é atribuído pela primeira vez
  IF TG_OP = 'UPDATE'
     AND OLD.proprietario_lead_crm IS NULL
     AND NEW.proprietario_lead_crm IS NOT NULL THEN
    INSERT INTO public.lead_activity_log (
      lead_id,
      event_type,
      entity_type,
      entity_name,
      event_data,
      source_channel,
      event_timestamp
    ) VALUES (
      NEW.id,
      'seller_assigned',
      'seller',
      NEW.proprietario_lead_crm,
      jsonb_build_object(
        'vendedor',     NEW.proprietario_lead_crm,
        'piperun_link', NEW.piperun_link
      ),
      'sistema',
      now()
    )
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[timeline-trigger] %', SQLERRM;
  RETURN NEW;
END;
$function$;

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY
        lead_id,
        source_channel,
        COALESCE(event_data->>'form_name', entity_name, ''),
        event_timestamp::date
      ORDER BY event_timestamp ASC, id ASC
    ) AS rn
  FROM public.lead_activity_log
  WHERE lead_id = '543af551-93a1-4b9f-803b-1a4ce3cdc1a2'
    AND event_type = 'form_submission'
    AND source_channel = 'meta_lead_ads'
)
DELETE FROM public.lead_activity_log lal
USING ranked r
WHERE lal.id = r.id
  AND r.rn > 1;