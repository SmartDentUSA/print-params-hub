-- Add content_type column to knowledge_videos for video classification
ALTER TABLE knowledge_videos 
ADD COLUMN IF NOT EXISTS content_type text DEFAULT NULL;

-- Auto-classify existing videos based on title patterns
UPDATE knowledge_videos SET content_type = 'depoimentos' 
WHERE LOWER(title) LIKE '%depoimento%' AND content_type IS NULL;

UPDATE knowledge_videos SET content_type = 'educacional' 
WHERE (LOWER(title) LIKE '%curso%' OR LOWER(title) LIKE '%aula%' OR LOWER(title) LIKE '%treinamento%') 
AND content_type IS NULL;

UPDATE knowledge_videos SET content_type = 'passo_a_passo' 
WHERE (LOWER(title) LIKE '%tutorial%' OR LOWER(title) LIKE '%como%' OR LOWER(title) LIKE '%passo%') 
AND content_type IS NULL;

UPDATE knowledge_videos SET content_type = 'lives' 
WHERE (LOWER(title) LIKE '%live%' OR LOWER(title) LIKE '%webinar%') 
AND content_type IS NULL;

UPDATE knowledge_videos SET content_type = 'cases_sucesso' 
WHERE (LOWER(title) LIKE '%case%' OR LOWER(title) LIKE '%sucesso%') 
AND content_type IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN knowledge_videos.content_type IS 'Video content classification: institucional, comercial, tecnico, passo_a_passo, educacional, depoimentos, cases_sucesso, lives';