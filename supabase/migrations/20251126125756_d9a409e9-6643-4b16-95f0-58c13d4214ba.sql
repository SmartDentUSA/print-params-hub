-- Adicionar campos de analytics em knowledge_videos
ALTER TABLE knowledge_videos
  ADD COLUMN IF NOT EXISTS analytics_views INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS analytics_unique_views INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS analytics_plays INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS analytics_unique_plays INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS analytics_play_rate NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS analytics_avg_retention NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS analytics_last_sync TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS relevance_score NUMERIC(5,2) DEFAULT 0;

-- Tabela de histórico para tendências
CREATE TABLE IF NOT EXISTS knowledge_video_metrics_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_video_id UUID REFERENCES knowledge_videos(id) ON DELETE CASCADE,
  pandavideo_id TEXT,
  views INTEGER,
  unique_views INTEGER,
  plays INTEGER,
  unique_plays INTEGER,
  play_rate NUMERIC(5,2),
  avg_retention NUMERIC(5,2),
  relevance_score NUMERIC(5,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_kv_relevance_score 
  ON knowledge_videos(relevance_score DESC);

CREATE INDEX IF NOT EXISTS idx_kv_content_id_not_null 
  ON knowledge_videos(content_id) WHERE content_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_kvml_video_id 
  ON knowledge_video_metrics_log(knowledge_video_id);

-- RLS para a nova tabela
ALTER TABLE knowledge_video_metrics_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read metrics log" ON knowledge_video_metrics_log
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage metrics log" ON knowledge_video_metrics_log
  FOR ALL USING (is_admin(auth.uid()));