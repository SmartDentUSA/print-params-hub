-- Adicionar coluna updated_at à tabela knowledge_videos
ALTER TABLE knowledge_videos 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Preencher dados existentes com created_at
UPDATE knowledge_videos 
SET updated_at = COALESCE(created_at, now())
WHERE updated_at IS NULL;

-- Criar trigger para atualização automática
CREATE TRIGGER update_knowledge_videos_updated_at
  BEFORE UPDATE ON knowledge_videos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();