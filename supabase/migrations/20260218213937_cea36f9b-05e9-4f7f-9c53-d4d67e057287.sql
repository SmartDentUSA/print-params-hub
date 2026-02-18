
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Table: agent_embeddings
CREATE TABLE IF NOT EXISTS public.agent_embeddings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  content_id uuid,
  source_type text NOT NULL, -- 'article' | 'video' | 'resin' | 'parameter'
  chunk_text text NOT NULL,
  embedding vector(768),
  metadata jsonb DEFAULT '{}',
  embedding_updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- HNSW index for fast cosine similarity search
CREATE INDEX IF NOT EXISTS agent_embeddings_embedding_hnsw_idx
  ON public.agent_embeddings
  USING hnsw (embedding vector_cosine_ops);

-- Index for filtering by source_type
CREATE INDEX IF NOT EXISTS agent_embeddings_source_type_idx
  ON public.agent_embeddings (source_type);

-- Function: match_agent_embeddings
CREATE OR REPLACE FUNCTION public.match_agent_embeddings(
  query_embedding vector(768),
  match_threshold float DEFAULT 0.70,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  source_type text,
  chunk_text text,
  metadata jsonb,
  similarity float
)
LANGUAGE sql STABLE
SET search_path TO 'public'
AS $$
  SELECT
    ae.id,
    ae.source_type,
    ae.chunk_text,
    ae.metadata,
    1 - (ae.embedding <=> query_embedding) AS similarity
  FROM public.agent_embeddings ae
  WHERE ae.embedding IS NOT NULL
    AND 1 - (ae.embedding <=> query_embedding) > match_threshold
  ORDER BY ae.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Table: agent_interactions
CREATE TABLE IF NOT EXISTS public.agent_interactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id text NOT NULL,
  user_message text NOT NULL,
  agent_response text,
  lang text DEFAULT 'pt-BR',
  top_similarity float,
  context_sources jsonb,
  feedback text DEFAULT 'none', -- 'positive' | 'negative' | 'none'
  feedback_comment text,
  unanswered boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Table: agent_knowledge_gaps
CREATE TABLE IF NOT EXISTS public.agent_knowledge_gaps (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  question text UNIQUE NOT NULL,
  frequency integer DEFAULT 1,
  lang text DEFAULT 'pt-BR',
  status text DEFAULT 'pending', -- 'pending' | 'in_progress' | 'resolved'
  resolution_note text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS for agent_embeddings
ALTER TABLE public.agent_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read agent_embeddings"
  ON public.agent_embeddings FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage agent_embeddings"
  ON public.agent_embeddings FOR ALL
  USING (is_admin(auth.uid()));

-- RLS for agent_interactions
ALTER TABLE public.agent_interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public insert agent_interactions"
  ON public.agent_interactions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can manage agent_interactions"
  ON public.agent_interactions FOR ALL
  USING (is_admin(auth.uid()));

-- RLS for agent_knowledge_gaps
ALTER TABLE public.agent_knowledge_gaps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage agent_knowledge_gaps"
  ON public.agent_knowledge_gaps FOR ALL
  USING (is_admin(auth.uid()));

-- Trigger for updated_at on agent_knowledge_gaps
CREATE TRIGGER update_agent_knowledge_gaps_updated_at
  BEFORE UPDATE ON public.agent_knowledge_gaps
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
