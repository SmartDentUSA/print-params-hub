
-- Cache de inteligência interna LIA ↔ Copilot
CREATE TABLE public.agent_internal_lookups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query_normalized text NOT NULL,
  query_original text NOT NULL,
  source_function text NOT NULL DEFAULT 'dra-lia',
  results_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  results_count integer NOT NULL DEFAULT 0,
  result_types text[] DEFAULT '{}'::text[],
  hit_count integer DEFAULT 1,
  last_hit_at timestamptz DEFAULT now(),
  session_id text,
  lead_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- FTS index for cache lookup
CREATE INDEX idx_internal_lookups_query ON public.agent_internal_lookups 
  USING gin(to_tsvector('portuguese', query_normalized));

-- Index for result types filtering
CREATE INDEX idx_internal_lookups_types ON public.agent_internal_lookups 
  USING gin(result_types);

-- Index for TTL cleanup and hit_count ranking
CREATE INDEX idx_internal_lookups_created ON public.agent_internal_lookups(created_at DESC);
CREATE INDEX idx_internal_lookups_hits ON public.agent_internal_lookups(hit_count DESC, last_hit_at DESC);

-- RLS: edge functions use service role, no RLS needed for this operational table
ALTER TABLE public.agent_internal_lookups ENABLE ROW LEVEL SECURITY;

-- Auto-update updated_at
CREATE TRIGGER trg_internal_lookups_updated_at
  BEFORE UPDATE ON public.agent_internal_lookups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
