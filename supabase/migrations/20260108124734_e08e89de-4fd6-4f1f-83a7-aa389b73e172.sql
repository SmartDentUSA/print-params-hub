-- Recriar função search_knowledge_base com tipo correto (double precision ao invés de real)
DROP FUNCTION IF EXISTS search_knowledge_base(text, text);

CREATE OR REPLACE FUNCTION search_knowledge_base(
  search_query text, 
  language_code text DEFAULT 'pt'
)
RETURNS TABLE(
  content_id uuid, 
  content_type text, 
  title text, 
  excerpt text, 
  slug text, 
  category_letter text, 
  category_name text, 
  relevance double precision,
  matched_field text
)
LANGUAGE plpgsql STABLE
AS $$
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
    )::double precision as relevance,
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
    ts_rank(kv.search_vector, plainto_tsquery('portuguese', search_query))::double precision as relevance,
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
$$;