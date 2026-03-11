
-- 1. Add UNIQUE constraint on query_normalized
ALTER TABLE public.agent_internal_lookups 
  ADD CONSTRAINT agent_internal_lookups_query_normalized_key UNIQUE (query_normalized);

-- 2. Drop existing FTS index (if any) and recreate with 'simple' dictionary
DROP INDEX IF EXISTS idx_internal_lookups_query;
CREATE INDEX idx_internal_lookups_query ON public.agent_internal_lookups 
  USING gin(to_tsvector('simple', query_normalized));

-- 3. Create index on result_types (GIN)
DROP INDEX IF EXISTS idx_internal_lookups_types;
CREATE INDEX idx_internal_lookups_types ON public.agent_internal_lookups 
  USING gin(result_types);

-- 4. Atomic RPC for incrementing hit_count
CREATE OR REPLACE FUNCTION public.increment_lookup_hit(lookup_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE public.agent_internal_lookups
  SET hit_count = hit_count + 1,
      last_hit_at = now()
  WHERE id = lookup_id;
END;
$$ LANGUAGE plpgsql;
