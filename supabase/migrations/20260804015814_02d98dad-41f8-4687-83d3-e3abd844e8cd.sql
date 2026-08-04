CREATE TABLE IF NOT EXISTS public.marketing_agent_api_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  endpoint text NOT NULL,
  method text NOT NULL,
  turma_id uuid,
  status_code integer NOT NULL,
  ok boolean NOT NULL DEFAULT true,
  caller_fingerprint text,
  duration_ms integer,
  details jsonb NOT NULL DEFAULT '{}'::jsonb
);

GRANT ALL ON public.marketing_agent_api_log TO service_role;

ALTER TABLE public.marketing_agent_api_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role manages marketing agent api log"
  ON public.marketing_agent_api_log FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_maal_created_at ON public.marketing_agent_api_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_maal_fingerprint_created ON public.marketing_agent_api_log (caller_fingerprint, created_at DESC);