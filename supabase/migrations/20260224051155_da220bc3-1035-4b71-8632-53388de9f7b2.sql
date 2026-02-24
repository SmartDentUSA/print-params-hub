CREATE OR REPLACE FUNCTION get_rag_stats()
RETURNS TABLE (
  source_type text,
  chunk_count bigint,
  last_indexed_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT
    ae.source_type,
    count(*)::bigint AS chunk_count,
    max(ae.embedding_updated_at) AS last_indexed_at
  FROM agent_embeddings ae
  GROUP BY ae.source_type
  ORDER BY chunk_count DESC;
$$;