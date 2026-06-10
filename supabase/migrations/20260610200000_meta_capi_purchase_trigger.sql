-- Meta CAPI Purchase Integration
-- Fires a server-side Purchase event to Meta Conversions API whenever
-- a deal's status changes to 'ganha' (won) in PipeRun.

-- ─────────────────────────────────────────────
-- 1. Log table (dedup + audit)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.meta_capi_event_log (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id         uuid        REFERENCES public.deals(id) ON DELETE SET NULL,
  piperun_deal_id text,
  event_name      text        NOT NULL,
  event_time      timestamptz,
  event_id        text,
  value           numeric,
  currency        text        DEFAULT 'BRL',
  meta_response   jsonb,
  success         boolean,
  sent_at         timestamptz DEFAULT now()
);

ALTER TABLE public.meta_capi_event_log ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS meta_capi_event_log_deal_event
  ON public.meta_capi_event_log (deal_id, event_name);

COMMENT ON TABLE public.meta_capi_event_log IS
  'Log de eventos Purchase enviados à Meta Conversions API. Usado para deduplicação e auditoria.';

-- ─────────────────────────────────────────────
-- 2. Trigger function on deals
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_trigger_meta_capi_purchase()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_url TEXT;
  v_key TEXT;
BEGIN
  -- Only fire when status transitions to 'ganha'
  IF NEW.status = 'ganha'
     AND (OLD IS NULL OR OLD.status IS DISTINCT FROM 'ganha')
  THEN
    v_url := current_setting('app.supabase_url', true);
    v_key := current_setting('app.service_role_key', true);

    IF v_url IS NOT NULL AND v_url <> '' AND v_key IS NOT NULL AND v_key <> '' THEN
      PERFORM net.http_post(
        url      := v_url || '/functions/v1/meta-capi-purchase',
        body     := jsonb_build_object('deal_id', NEW.id::text),
        headers  := jsonb_build_object(
                      'Content-Type',  'application/json',
                      'Authorization', 'Bearer ' || v_key
                    ),
        timeout_milliseconds := 5000
      );
      RAISE LOG '[meta-capi] Queued Purchase for deal % (piperun_id=%)',
        NEW.id, NEW.piperun_deal_id;
    ELSE
      RAISE LOG '[meta-capi] Skipped (app settings missing) for deal %', NEW.id;
    END IF;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never abort the deal update because of CAPI failure
  RAISE LOG '[meta-capi] Trigger error for deal %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────
-- 3. Attach trigger
-- ─────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_meta_capi_purchase ON public.deals;
CREATE TRIGGER trg_meta_capi_purchase
  AFTER INSERT OR UPDATE OF status ON public.deals
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_trigger_meta_capi_purchase();
