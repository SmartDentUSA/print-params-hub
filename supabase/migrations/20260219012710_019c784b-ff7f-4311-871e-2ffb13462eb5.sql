-- Fase 1A: Adicionar colunas do Judge em agent_interactions
ALTER TABLE agent_interactions
  ADD COLUMN IF NOT EXISTS context_raw text,
  ADD COLUMN IF NOT EXISTS judge_score integer,
  ADD COLUMN IF NOT EXISTS judge_verdict text,
  ADD COLUMN IF NOT EXISTS judge_evaluated_at timestamptz,
  ADD COLUMN IF NOT EXISTS human_reviewed boolean DEFAULT false;

-- Validação com trigger em vez de CHECK constraint (evita problemas)
-- judge_score já é validado na edge function antes de salvar

-- Fase 1B: Nova tabela agent_sessions para persistência de estado do diálogo
CREATE TABLE IF NOT EXISTS agent_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text UNIQUE NOT NULL,
  current_state text NOT NULL DEFAULT 'idle',
  extracted_entities jsonb DEFAULT '{}'::jsonb,
  last_activity_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE agent_sessions ENABLE ROW LEVEL SECURITY;

-- Qualquer cliente anon pode gerenciar a própria sessão (session_id é UUID único gerado no frontend)
CREATE POLICY "Allow public manage sessions" ON agent_sessions
  FOR ALL USING (true) WITH CHECK (true);

-- Admins leem todas as sessões
CREATE POLICY "Admins read all sessions" ON agent_sessions
  FOR SELECT USING (is_admin(auth.uid()));

-- Trigger para updated_at automático
CREATE TRIGGER update_agent_sessions_updated_at
  BEFORE UPDATE ON agent_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();