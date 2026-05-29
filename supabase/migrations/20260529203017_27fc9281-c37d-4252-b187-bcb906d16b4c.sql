CREATE TABLE IF NOT EXISTS public.wa_contact_sync_queue (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id       uuid NOT NULL,
  phone_e164    text NOT NULL,
  contact_name  text,
  status        text NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','processing','done','failed')),
  attempts      int  NOT NULL DEFAULT 0,
  last_error    text,
  per_instance  jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  processed_at  timestamptz
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wa_contact_sync_queue TO authenticated;
GRANT ALL ON public.wa_contact_sync_queue TO service_role;

ALTER TABLE public.wa_contact_sync_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wa_contact_sync_queue admin read"
  ON public.wa_contact_sync_queue FOR SELECT TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_wa_contact_sync_pending
  ON public.wa_contact_sync_queue (status, created_at)
  WHERE status IN ('pending','processing');

CREATE INDEX IF NOT EXISTS idx_wa_contact_sync_lead
  ON public.wa_contact_sync_queue (lead_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.fn_enqueue_wa_contact_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone text;
  v_name  text;
BEGIN
  IF NEW.merged_into IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Prioriza telefone_normalized (dígitos); cai para wa_phone / telefone_raw
  v_phone := NULLIF(regexp_replace(
              COALESCE(NEW.telefone_normalized, NEW.wa_phone, NEW.telefone_raw, ''),
              '\D', '', 'g'), '');
  IF v_phone IS NULL OR length(v_phone) < 10 THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.telefone_normalized IS NOT DISTINCT FROM OLD.telefone_normalized
       AND NEW.wa_phone         IS NOT DISTINCT FROM OLD.wa_phone
       AND NEW.nome             IS NOT DISTINCT FROM OLD.nome
       AND OLD.merged_into      IS NOT DISTINCT FROM NEW.merged_into THEN
      RETURN NEW;
    END IF;
  END IF;

  v_name := NULLIF(trim(COALESCE(NEW.nome, '')), '');

  IF EXISTS (
    SELECT 1 FROM public.wa_contact_sync_queue
     WHERE lead_id = NEW.id
       AND status IN ('pending','processing')
       AND created_at > now() - interval '60 seconds'
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.wa_contact_sync_queue (lead_id, phone_e164, contact_name)
  VALUES (NEW.id, v_phone, v_name);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_wa_contact_sync_enqueue ON public.lia_attendances;
CREATE TRIGGER trg_wa_contact_sync_enqueue
  AFTER INSERT OR UPDATE OF telefone_normalized, wa_phone, telefone_raw, nome, merged_into
  ON public.lia_attendances
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_enqueue_wa_contact_sync();