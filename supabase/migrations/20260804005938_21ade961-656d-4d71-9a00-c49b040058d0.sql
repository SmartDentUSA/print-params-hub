ALTER TABLE public.lead_activity_log ADD COLUMN IF NOT EXISTS dedupe_hash text;

CREATE OR REPLACE FUNCTION public.fn_lal_dedupe_hash(
  _event_type text, _entity_id text, _event_data jsonb, _event_timestamp timestamptz, _source_channel text
) RETURNS text
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    -- chave explícita enviada pelo writer (webhook PipeRun, normalizer, trigger de form)
    WHEN NULLIF(_event_data->>'dedupe_key','') IS NOT NULL
      THEN md5(_event_type || '|' || (_event_data->>'dedupe_key'))
    -- crm_deal_*: snapshot de negócio (NUNCA só o timestamp)
    WHEN _event_type LIKE 'crm_deal_%' THEN md5(
      _event_type || '|' || COALESCE(_entity_id,'') || '|' ||
      COALESCE(_event_data->>'stage_id','') || '|' || COALESCE(_event_data->>'stage','') || '|' ||
      COALESCE(_event_data->>'status','') || '|' || COALESCE(_event_data->>'value','') || '|' ||
      COALESCE(_event_data->>'owner','') || '|' || COALESCE(_event_timestamp::text,'')
    )
    WHEN _event_type = 'crm_activity' AND COALESCE(_entity_id,'') <> ''
      THEN md5('crm_activity|' || _entity_id)
    WHEN _event_type = 'form_submission' THEN md5(
      'form_submission|' || COALESCE(_source_channel,'') || '|' ||
      COALESCE(_event_data->>'form_name','') || '|' ||
      COALESCE(date_trunc('day', _event_timestamp)::text,'')
    )
    ELSE NULL
  END
$$;

CREATE OR REPLACE FUNCTION public.trg_lal_dedupe()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_hash text;
BEGIN
  v_hash := COALESCE(
    NEW.dedupe_hash,
    public.fn_lal_dedupe_hash(NEW.event_type, NEW.entity_id, COALESCE(NEW.event_data,'{}'::jsonb), NEW.event_timestamp, NEW.source_channel)
  );
  IF v_hash IS NULL THEN
    RETURN NEW;
  END IF;
  NEW.dedupe_hash := v_hash;
  IF EXISTS (
    SELECT 1 FROM public.lead_activity_log
    WHERE lead_id = NEW.lead_id AND event_type = NEW.event_type AND dedupe_hash = v_hash
  ) THEN
    RETURN NULL; -- descarta silenciosamente: nenhum writer quebra
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lal_dedupe_before_insert ON public.lead_activity_log;
CREATE TRIGGER trg_lal_dedupe_before_insert
BEFORE INSERT ON public.lead_activity_log
FOR EACH ROW EXECUTE FUNCTION public.trg_lal_dedupe();

CREATE OR REPLACE VIEW public.v_lead_timeline AS
 SELECT lead_id, 'activity'::text AS event_category, event_type AS event_name, event_timestamp,
    COALESCE(entity_name, event_data ->> 'description') AS details, source_channel
   FROM public.lead_activity_log
UNION ALL
 SELECT lead_id, 'course'::text, 'course_' || status,
    COALESCE(completed_at, last_accessed_at, started_at),
    (course_name || ' (') || COALESCE(progress_pct, 0) || '%)', 'astron'::text
   FROM public.lead_course_progress
UNION ALL
 SELECT lead_id, 'product'::text,
    CASE WHEN purchased_at IS NOT NULL THEN 'product_purchased'
         WHEN added_to_cart_at IS NOT NULL THEN 'product_carted'
         ELSE 'product_viewed' END,
    COALESCE(purchased_at, added_to_cart_at, last_viewed_at), product_name, 'ecommerce'::text
   FROM public.lead_product_history
 ORDER BY 4 DESC;