-- Limpar duplicatas mantendo o registro mais recente
WITH duplicates AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY pandavideo_id 
      ORDER BY created_at DESC, id DESC
    ) as rn
  FROM knowledge_videos
  WHERE pandavideo_id IS NOT NULL
)
DELETE FROM knowledge_videos
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- Adicionar UNIQUE constraint em pandavideo_id
ALTER TABLE knowledge_videos 
ADD CONSTRAINT knowledge_videos_pandavideo_id_unique 
UNIQUE (pandavideo_id);

-- Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_knowledge_videos_pandavideo_id 
ON knowledge_videos(pandavideo_id) 
WHERE pandavideo_id IS NOT NULL;

-- Adicionar comentário para documentação
COMMENT ON CONSTRAINT knowledge_videos_pandavideo_id_unique 
ON knowledge_videos 
IS 'Garante que cada vídeo do PandaVideo aparece apenas uma vez';