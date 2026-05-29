
-- ═══════════════════════════════════════════════════════════════════
-- Frente A: smartdent_method_docs (RAG do Copilot)
-- ═══════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS public.smartdent_method_docs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_doc_id uuid NOT NULL,
  chunk_index int NOT NULL DEFAULT 0,
  title text NOT NULL,
  slug text,
  doc_type text NOT NULL DEFAULT 'outro',
  target_audience text[] DEFAULT '{}'::text[],
  target_products text[] DEFAULT '{}'::text[],
  body_md text NOT NULL,
  embedding vector(768),
  tokens int,
  active boolean NOT NULL DEFAULT true,
  uploaded_by uuid,
  source_storage_path text,
  source_metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.smartdent_method_docs TO authenticated;
GRANT ALL ON public.smartdent_method_docs TO service_role;

ALTER TABLE public.smartdent_method_docs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read active method docs"
  ON public.smartdent_method_docs FOR SELECT
  TO authenticated
  USING (active = true);

CREATE POLICY "Service role full access method docs"
  ON public.smartdent_method_docs FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_method_docs_source ON public.smartdent_method_docs(source_doc_id);
CREATE INDEX IF NOT EXISTS idx_method_docs_doc_type ON public.smartdent_method_docs(doc_type) WHERE active;
CREATE INDEX IF NOT EXISTS idx_method_docs_audience ON public.smartdent_method_docs USING GIN(target_audience);
CREATE INDEX IF NOT EXISTS idx_method_docs_products ON public.smartdent_method_docs USING GIN(target_products);
CREATE INDEX IF NOT EXISTS idx_method_docs_embedding ON public.smartdent_method_docs
  USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);

CREATE TRIGGER trg_method_docs_updated_at
  BEFORE UPDATE ON public.smartdent_method_docs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ───── RPC: match_method_docs ─────
CREATE OR REPLACE FUNCTION public.match_method_docs(
  query_embedding vector(768),
  match_count int DEFAULT 8,
  match_threshold float DEFAULT 0.55,
  filter_audience text[] DEFAULT NULL,
  filter_products text[] DEFAULT NULL,
  filter_doc_type text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  source_doc_id uuid,
  title text,
  doc_type text,
  target_audience text[],
  target_products text[],
  body_md text,
  similarity float
)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT
    d.id,
    d.source_doc_id,
    d.title,
    d.doc_type,
    d.target_audience,
    d.target_products,
    d.body_md,
    1 - (d.embedding <=> query_embedding) AS similarity
  FROM public.smartdent_method_docs d
  WHERE d.active = true
    AND d.embedding IS NOT NULL
    AND (1 - (d.embedding <=> query_embedding)) >= match_threshold
    AND (filter_doc_type IS NULL OR d.doc_type = filter_doc_type)
    AND (filter_audience IS NULL OR d.target_audience && filter_audience)
    AND (filter_products IS NULL OR d.target_products && filter_products)
  ORDER BY d.embedding <=> query_embedding
  LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION public.match_method_docs TO authenticated, service_role;

-- ═══════════════════════════════════════════════════════════════════
-- Frente B: extensão de knowledge_contents (autoria pelo Copilot)
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.knowledge_contents
  ADD COLUMN IF NOT EXISTS created_by text NOT NULL DEFAULT 'human',
  ADD COLUMN IF NOT EXISTS source_method_docs uuid[] DEFAULT '{}'::uuid[],
  ADD COLUMN IF NOT EXISTS draft_metadata jsonb DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_knowledge_contents_created_by ON public.knowledge_contents(created_by) WHERE created_by = 'copilot';

-- ═══════════════════════════════════════════════════════════════════
-- Storage bucket: smartdent-method-docs (privado)
-- ═══════════════════════════════════════════════════════════════════

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'smartdent-method-docs',
  'smartdent-method-docs',
  false,
  20971520, -- 20 MB
  ARRAY['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain','text/markdown','application/octet-stream']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Service role já tem acesso total; usuários autenticados podem fazer upload mas não listar/baixar
CREATE POLICY "Authenticated upload method docs"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'smartdent-method-docs');
