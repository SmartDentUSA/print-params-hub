CREATE TABLE IF NOT EXISTS public.crm_timeline_unresolved (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source TEXT NOT NULL,
  kind TEXT NOT NULL,
  entity_id TEXT,
  deal_id BIGINT,
  person_piperun_id BIGINT,
  email TEXT,
  event_timestamp TIMESTAMP WITH TIME ZONE,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  attempts INTEGER NOT NULL DEFAULT 1,
  last_attempt_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_lead_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT ON public.crm_timeline_unresolved TO authenticated;
GRANT ALL ON public.crm_timeline_unresolved TO service_role;

ALTER TABLE public.crm_timeline_unresolved ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view unresolved crm timeline"
ON public.crm_timeline_unresolved FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE UNIQUE INDEX IF NOT EXISTS uq_crm_timeline_unresolved
ON public.crm_timeline_unresolved (kind, entity_id) WHERE entity_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_crm_timeline_unresolved_pending
ON public.crm_timeline_unresolved (created_at DESC) WHERE resolved_at IS NULL;

CREATE OR REPLACE FUNCTION public.fn_crm_timeline_unresolved_touch()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  NEW.last_attempt_at = now();
  IF TG_OP = 'UPDATE' THEN
    NEW.attempts = COALESCE(OLD.attempts, 0) + 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_crm_timeline_unresolved_touch ON public.crm_timeline_unresolved;
CREATE TRIGGER trg_crm_timeline_unresolved_touch
BEFORE INSERT OR UPDATE ON public.crm_timeline_unresolved
FOR EACH ROW EXECUTE FUNCTION public.fn_crm_timeline_unresolved_touch();