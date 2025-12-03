-- Desvincular os 195 vídeos incorretamente vinculados ao artigo 'Parâmetros miicraft alpha - Smart Dent'
UPDATE knowledge_videos 
SET content_id = NULL 
WHERE content_id = 'f292e3d7-51f0-4065-af5e-aa5322c58332';

-- Log da operação
DO $$
DECLARE
  affected_count INTEGER;
BEGIN
  GET DIAGNOSTICS affected_count = ROW_COUNT;
  RAISE NOTICE 'Videos desvinculados: %', affected_count;
END $$;