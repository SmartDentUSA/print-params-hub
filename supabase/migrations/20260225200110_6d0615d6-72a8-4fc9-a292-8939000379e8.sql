
ALTER TABLE lia_attendances
  ADD COLUMN IF NOT EXISTS total_sessions integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_messages integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS historico_resumos jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS ultima_sessao_at timestamptz;
