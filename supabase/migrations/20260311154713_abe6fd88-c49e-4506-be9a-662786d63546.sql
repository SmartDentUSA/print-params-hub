-- Phase 2: Shadow Indexing — add vector_v2 column for zero-downtime re-indexing
-- and embedding_model tracking

-- Add vector_v2 column for new model embeddings (Matryoshka 768 dims)
ALTER TABLE public.agent_embeddings
  ADD COLUMN IF NOT EXISTS vector_v2 vector(768);

-- Track which model generated each embedding
ALTER TABLE public.agent_embeddings
  ADD COLUMN IF NOT EXISTS embedding_model text DEFAULT 'embedding-001';

-- HNSW index on vector_v2 for cosine similarity search
CREATE INDEX IF NOT EXISTS idx_agent_embeddings_vector_v2_hnsw
  ON public.agent_embeddings
  USING hnsw (vector_v2 vector_cosine_ops);

-- RPC to match against vector_v2 (used after Phase 2 re-indexing is complete)
CREATE OR REPLACE FUNCTION public.match_agent_embeddings_v2(
  query_embedding vector,
  match_threshold double precision DEFAULT 0.60,
  match_count integer DEFAULT 10
)
RETURNS TABLE(
  id uuid,
  source_type text,
  chunk_text text,
  metadata jsonb,
  similarity double precision
)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT
    ae.id,
    ae.source_type,
    ae.chunk_text,
    ae.metadata,
    1 - (ae.vector_v2 <=> query_embedding) AS similarity
  FROM public.agent_embeddings ae
  WHERE ae.vector_v2 IS NOT NULL
    AND 1 - (ae.vector_v2 <=> query_embedding) > match_threshold
  ORDER BY ae.vector_v2 <=> query_embedding
  LIMIT match_count;
$$;