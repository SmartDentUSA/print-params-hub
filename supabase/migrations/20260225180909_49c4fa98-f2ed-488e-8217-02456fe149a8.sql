ALTER TABLE agent_knowledge_gaps
  ADD COLUMN IF NOT EXISTS tema text,
  ADD COLUMN IF NOT EXISTS rota text;