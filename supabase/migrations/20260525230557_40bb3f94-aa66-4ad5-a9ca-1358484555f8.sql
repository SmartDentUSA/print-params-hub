
-- ── 1. Trigger hardening: dedupe seller_assigned by (lead_id, seller_name) within 1h ──
CREATE OR REPLACE FUNCTION public.fn_log_form_submission_to_timeline()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_source_channel text;
  v_form_name text;
  v_entity_id text;
  v_recent_exists boolean;
  v_recent_seller boolean;
BEGIN
  -- Form submission log (unchanged)
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
        lead_id, event_type, entity_type, entity_id, entity_name,
        event_data, source_channel, event_timestamp
      ) VALUES (
        NEW.id, 'form_submission', 'form', v_entity_id, v_form_name,
        jsonb_build_object(
          'form_name', NEW.form_name, 'source', NEW.source,
          'produto_interesse', NEW.produto_interesse, 'area_atuacao', NEW.area_atuacao,
          'email', NEW.email, 'telefone', NEW.telefone_normalized,
          'origem_campanha', NEW.origem_campanha, 'piperun_link', NEW.piperun_link,
          'dedupe_key', v_entity_id
        ),
        v_source_channel, now()
      )
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  -- Deal created (first piperun_id assignment)
  IF TG_OP = 'UPDATE'
     AND OLD.piperun_id IS NULL
     AND NEW.piperun_id IS NOT NULL THEN
    INSERT INTO public.lead_activity_log (
      lead_id, event_type, entity_type, entity_name,
      event_data, source_channel, event_timestamp
    ) VALUES (
      NEW.id, 'deal_created', 'deal',
      COALESCE(NEW.form_name, 'Novo Deal'),
      jsonb_build_object('piperun_id', NEW.piperun_id, 'piperun_link', NEW.piperun_link, 'vendedor', NEW.proprietario_lead_crm),
      'piperun', now()
    )
    ON CONFLICT DO NOTHING;
  END IF;

  -- Seller assigned — HARDENED: skip if SAME seller assigned to SAME lead
  -- within the last 1h. Protects against meta-pull re-delivery loops where
  -- lia-assign clears proprietario_lead_crm to NULL and re-sets it each cycle.
  IF TG_OP = 'UPDATE'
     AND OLD.proprietario_lead_crm IS DISTINCT FROM NEW.proprietario_lead_crm
     AND NEW.proprietario_lead_crm IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.lead_activity_log lal
      WHERE lal.lead_id = NEW.id
        AND lal.event_type = 'seller_assigned'
        AND lal.entity_name = NEW.proprietario_lead_crm
        AND lal.event_timestamp >= now() - interval '1 hour'
      LIMIT 1
    ) INTO v_recent_seller;

    IF NOT v_recent_seller THEN
      INSERT INTO public.lead_activity_log (
        lead_id, event_type, entity_type, entity_name,
        event_data, source_channel, event_timestamp
      ) VALUES (
        NEW.id, 'seller_assigned', 'seller', NEW.proprietario_lead_crm,
        jsonb_build_object('vendedor', NEW.proprietario_lead_crm, 'piperun_link', NEW.piperun_link),
        'sistema', now()
      )
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[timeline-trigger] %', SQLERRM;
  RETURN NEW;
END;
$function$;

-- ── 2. Backfill the 3 looping leads with their leadgen_id archive ──
UPDATE public.lia_attendances
SET raw_payload = jsonb_set(
      COALESCE(raw_payload, '{}'::jsonb),
      '{previous_platform_lead_ids}',
      to_jsonb(ARRAY[
        '1309468353919888','1852019002160386','994460442184175',
        '2074883396422916','2221100968425819','9999999999999999','7777777777777777',
        '1853424102139156','1695326341666157','2212633665940663'
      ]),
      true
    )
WHERE id IN (
  '33c5006c-5b02-478d-8f21-9d46b0c5a711',
  '543af551-93a1-4b9f-803b-1a4ce3cdc1a2',
  '42dcab5c-6501-4130-8d44-1000e3bbff91'
);

-- Tatianna had NULL platform identifiers → enable HARD_DEDUPE in ingest-lead
UPDATE public.lia_attendances
SET platform_lead_id = COALESCE(platform_lead_id, '2212633665940663'),
    platform_form_id = COALESCE(platform_form_id, '1853424102139156')
WHERE id = '33c5006c-5b02-478d-8f21-9d46b0c5a711';

-- Miguel had piperun_id NULLed mid-cycle → restore the canonical Deal id
UPDATE public.lia_attendances
SET piperun_id = '60082721'
WHERE id = '543af551-93a1-4b9f-803b-1a4ce3cdc1a2'
  AND piperun_id IS NULL;

-- ── 3. Purge duplicate seller_assigned events from the last 24h for the 3 leads ──
-- Keep only the earliest event per (lead_id, seller_name).
DELETE FROM public.lead_activity_log
WHERE event_type = 'seller_assigned'
  AND lead_id IN (
    '33c5006c-5b02-478d-8f21-9d46b0c5a711',
    '543af551-93a1-4b9f-803b-1a4ce3cdc1a2',
    '42dcab5c-6501-4130-8d44-1000e3bbff91'
  )
  AND event_timestamp > now() - interval '24 hours'
  AND id NOT IN (
    SELECT DISTINCT ON (lead_id, entity_name) id
    FROM public.lead_activity_log
    WHERE event_type = 'seller_assigned'
      AND lead_id IN (
        '33c5006c-5b02-478d-8f21-9d46b0c5a711',
        '543af551-93a1-4b9f-803b-1a4ce3cdc1a2',
        '42dcab5c-6501-4130-8d44-1000e3bbff91'
      )
      AND event_timestamp > now() - interval '24 hours'
    ORDER BY lead_id, entity_name, event_timestamp ASC
  );
