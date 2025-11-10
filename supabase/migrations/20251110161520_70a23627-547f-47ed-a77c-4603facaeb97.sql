-- ETAPA 1: Adicionar campos à tabela knowledge_videos
ALTER TABLE knowledge_videos
ADD COLUMN IF NOT EXISTS panda_custom_fields jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS panda_tags text[] DEFAULT '{}'::text[],
ADD COLUMN IF NOT EXISTS analytics jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS video_transcript text,
ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES system_a_catalog(id),
ADD COLUMN IF NOT EXISTS resin_id uuid REFERENCES resins(id),
ADD COLUMN IF NOT EXISTS product_external_id text,
ADD COLUMN IF NOT EXISTS product_category text,
ADD COLUMN IF NOT EXISTS product_subcategory text,
ADD COLUMN IF NOT EXISTS last_product_sync_at timestamp,
ADD COLUMN IF NOT EXISTS product_match_status text DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Criar índices
CREATE INDEX IF NOT EXISTS idx_knowledge_videos_search_vector 
ON knowledge_videos USING gin(search_vector);

CREATE INDEX IF NOT EXISTS idx_knowledge_videos_product_external_id 
ON knowledge_videos(product_external_id);

CREATE INDEX IF NOT EXISTS idx_knowledge_videos_custom_fields 
ON knowledge_videos USING gin(panda_custom_fields);

-- Extensão necessária para busca
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Função para atualizar search_vector
CREATE OR REPLACE FUNCTION update_knowledge_videos_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('portuguese',
    coalesce(NEW.title, '') || ' ' ||
    coalesce(NEW.description, '') || ' ' ||
    coalesce(NEW.video_transcript, '') || ' ' ||
    coalesce(array_to_string(NEW.panda_tags, ' '), '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar search_vector automaticamente
DROP TRIGGER IF EXISTS trigger_update_knowledge_videos_search_vector ON knowledge_videos;
CREATE TRIGGER trigger_update_knowledge_videos_search_vector
BEFORE INSERT OR UPDATE ON knowledge_videos
FOR EACH ROW
EXECUTE FUNCTION update_knowledge_videos_search_vector();

-- Atualizar search_vector para registros existentes
UPDATE knowledge_videos SET search_vector = to_tsvector('portuguese',
  coalesce(title, '') || ' ' ||
  coalesce(description, '') || ' ' ||
  coalesce(video_transcript, '') || ' ' ||
  coalesce(array_to_string(panda_tags, ' '), '')
);

-- ETAPA 3: Criar função RPC search_knowledge_base
CREATE OR REPLACE FUNCTION search_knowledge_base(
  search_query text,
  language_code text DEFAULT 'pt'
)
RETURNS TABLE (
  content_id uuid,
  content_type text,
  title text,
  excerpt text,
  slug text,
  category_letter text,
  category_name text,
  relevance real,
  matched_field text
) AS $$
BEGIN
  RETURN QUERY
  
  -- 1. Buscar em artigos
  SELECT 
    kc.id as content_id,
    'article'::text as content_type,
    CASE 
      WHEN language_code = 'es' AND kc.title_es IS NOT NULL THEN kc.title_es
      WHEN language_code = 'en' AND kc.title_en IS NOT NULL THEN kc.title_en
      ELSE kc.title
    END as title,
    CASE 
      WHEN language_code = 'es' AND kc.excerpt_es IS NOT NULL THEN kc.excerpt_es
      WHEN language_code = 'en' AND kc.excerpt_en IS NOT NULL THEN kc.excerpt_en
      ELSE kc.excerpt
    END as excerpt,
    kc.slug,
    kcat.letter as category_letter,
    kcat.name as category_name,
    GREATEST(
      similarity(kc.title, search_query),
      similarity(kc.excerpt, search_query),
      similarity(coalesce(kc.content_html, ''), search_query) * 0.5
    ) as relevance,
    'article' as matched_field
  FROM knowledge_contents kc
  LEFT JOIN knowledge_categories kcat ON kc.category_id = kcat.id
  WHERE 
    kc.active = true
    AND (
      kc.title ILIKE '%' || search_query || '%'
      OR kc.excerpt ILIKE '%' || search_query || '%'
      OR kc.content_html ILIKE '%' || search_query || '%'
      OR kc.keywords::text ILIKE '%' || search_query || '%'
      OR kc.faqs::text ILIKE '%' || search_query || '%'
    )
  
  UNION ALL
  
  -- 2. Buscar em vídeos
  SELECT 
    kc.id as content_id,
    'video'::text as content_type,
    kc.title,
    kc.excerpt,
    kc.slug,
    kcat.letter as category_letter,
    kcat.name as category_name,
    ts_rank(kv.search_vector, plainto_tsquery('portuguese', search_query)) as relevance,
    'video: ' || kv.title as matched_field
  FROM knowledge_videos kv
  JOIN knowledge_contents kc ON kv.content_id = kc.id
  LEFT JOIN knowledge_categories kcat ON kc.category_id = kcat.id
  WHERE 
    kc.active = true
    AND kv.search_vector @@ plainto_tsquery('portuguese', search_query)
  
  ORDER BY relevance DESC
  LIMIT 50;
END;
$$ LANGUAGE plpgsql STABLE;