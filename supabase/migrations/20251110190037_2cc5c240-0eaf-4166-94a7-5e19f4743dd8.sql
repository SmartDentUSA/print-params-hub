-- Adicionar campo panda_config para armazenar configuração completa da API PandaVideo
ALTER TABLE knowledge_videos
ADD COLUMN IF NOT EXISTS panda_config JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN knowledge_videos.panda_config IS 'Configuração completa retornada pela API PandaVideo (config object): subtitles, ai, resolutions, original_lang, etc.';