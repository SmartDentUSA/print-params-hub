-- Alterar tabela knowledge_videos para suportar PandaVideo
-- Remover constraint NOT NULL do campo url (para permitir PandaVideo)
ALTER TABLE knowledge_videos 
  ALTER COLUMN url DROP NOT NULL;

-- Adicionar novos campos para PandaVideo
ALTER TABLE knowledge_videos
  ADD COLUMN IF NOT EXISTS video_type text NOT NULL DEFAULT 'youtube',
  ADD COLUMN IF NOT EXISTS pandavideo_id text,
  ADD COLUMN IF NOT EXISTS pandavideo_external_id text,
  ADD COLUMN IF NOT EXISTS folder_id text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS thumbnail_url text,
  ADD COLUMN IF NOT EXISTS preview_url text,
  ADD COLUMN IF NOT EXISTS embed_url text,
  ADD COLUMN IF NOT EXISTS hls_url text,
  ADD COLUMN IF NOT EXISTS video_duration_seconds integer,
  ADD COLUMN IF NOT EXISTS analytics jsonb;

-- Adicionar constraint check para video_type
ALTER TABLE knowledge_videos
  ADD CONSTRAINT check_video_type 
  CHECK (video_type IN ('youtube', 'pandavideo'));

-- Adicionar constraint: se video_type = 'pandavideo', pandavideo_id deve existir
-- se video_type = 'youtube', url deve existir
ALTER TABLE knowledge_videos
  ADD CONSTRAINT check_video_fields
  CHECK (
    (video_type = 'youtube' AND url IS NOT NULL) OR
    (video_type = 'pandavideo' AND pandavideo_id IS NOT NULL)
  );

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_knowledge_videos_video_type 
  ON knowledge_videos(video_type);
  
CREATE INDEX IF NOT EXISTS idx_knowledge_videos_pandavideo_id 
  ON knowledge_videos(pandavideo_id) 
  WHERE pandavideo_id IS NOT NULL;
  
CREATE INDEX IF NOT EXISTS idx_knowledge_videos_folder_id 
  ON knowledge_videos(folder_id) 
  WHERE folder_id IS NOT NULL;

-- Criar tabela para armazenar pastas do PandaVideo
CREATE TABLE IF NOT EXISTS pandavideo_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pandavideo_id text NOT NULL UNIQUE,
  name text NOT NULL,
  parent_folder_id text,
  videos_count integer DEFAULT 0,
  last_sync_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS Policies para pandavideo_folders
ALTER TABLE pandavideo_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read pandavideo_folders"
  ON pandavideo_folders FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage pandavideo_folders"
  ON pandavideo_folders FOR ALL
  USING (is_admin(auth.uid()));

-- Índice para hierarquia de pastas
CREATE INDEX IF NOT EXISTS idx_pandavideo_folders_parent 
  ON pandavideo_folders(parent_folder_id);

-- Trigger para atualizar updated_at em pandavideo_folders
CREATE TRIGGER update_pandavideo_folders_updated_at
  BEFORE UPDATE ON pandavideo_folders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comentários para documentação
COMMENT ON COLUMN knowledge_videos.video_type IS 'Tipo de vídeo: youtube ou pandavideo';
COMMENT ON COLUMN knowledge_videos.pandavideo_id IS 'ID interno do PandaVideo';
COMMENT ON COLUMN knowledge_videos.pandavideo_external_id IS 'ID externo do PandaVideo (usado em embed/HLS)';
COMMENT ON COLUMN knowledge_videos.folder_id IS 'ID da pasta no PandaVideo';
COMMENT ON TABLE pandavideo_folders IS 'Armazena estrutura de pastas do PandaVideo para organização';