-- Safety-net: capture form_name changes on canonical Meta leads and let a cron
-- guarantee the universal enrichment + deal-route runs even when the UPDATE
-- did not come through smart-ops-ingest-lead.

CREATE TABLE IF NOT EXISTS public.enrichment_safety_queue (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id uuid NOT NULL REFERENCES public.lia_attendances(id) ON DELETE CASCADE,
  source text NOT NULL,
  old_form_name text,
  new_form_name text,
  detected_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  processing_result jsonb,
  attempt_count int NOT NULL DEFAULT 0,
  last_error text
);

GRANT SELECT, INSERT, UPDATE ON public.enrichment_safety_queue TO authenticated;
GRANT ALL ON public.enrichment_safety_queue TO service_role;

ALTER TABLE public.enrichment_safety_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role full access enrichment_safety_queue"
ON public.enrichment_safety_queue
FOR ALL
TO service_role
USING (true) WITH CHECK (true);

CREATE POLICY "authenticated can read enrichment_safety_queue"
ON public.enrichment_safety_queue
FOR SELECT
TO authenticated
USING (true);

CREATE INDEX IF NOT EXISTS idx_enrichment_safety_queue_unprocessed
  ON public.enrichment_safety_queue (detected_at)
  WHERE processed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_enrichment_safety_queue_lead
  ON public.enrichment_safety_queue (lead_id, detected_at DESC);

-- Extend timeline trigger to also enqueue safety-net work when form_name
-- changes on canonical Meta leads. Keeps all existing behavior intact.
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
  v_recent_safety boolean;
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

    -- ─── SAFETY-NET ENQUEUE ───
    -- Quando o form_name muda em um lead canônico Meta sem passar pelo
    -- ingest-lead (ex.: cron PipeRun-pull, integração nativa direta),
    -- enfileiramos para o cron rodar a régua universal de enrichment+deal.
    IF TG_OP = 'UPDATE'
       AND OLD.form_name IS DISTINCT FROM NEW.form_name
       AND COALESCE(NEW.source, '') = 'meta_lead_ads'
       AND NEW.merged_into IS NULL THEN
      -- Debounce: evita re-enfileirar o mesmo lead se já há pendente nas
      -- últimas 5 minutos (cron roda 1x/min, então 5 min cobre re-tentativas)
      SELECT EXISTS (
        SELECT 1 FROM public.enrichment_safety_queue
        WHERE lead_id = NEW.id
          AND detected_at >= now() - interval '5 minutes'
          AND (processed_at IS NULL OR processed_at >= now() - interval '5 minutes')
        LIMIT 1
      ) INTO v_recent_safety;

      IF NOT v_recent_safety THEN
        INSERT INTO public.enrichment_safety_queue (
          lead_id, source, old_form_name, new_form_name
        ) VALUES (
          NEW.id, COALESCE(NEW.source, 'sistema'), OLD.form_name, NEW.form_name
        );
      END IF;
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

  -- Seller assigned — HARDENED
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