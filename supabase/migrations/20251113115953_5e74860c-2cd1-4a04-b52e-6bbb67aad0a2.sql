-- Adicionar colunas para contexto de IA multilíngue nas páginas de conhecimento
ALTER TABLE knowledge_contents
ADD COLUMN IF NOT EXISTS ai_context_en TEXT,
ADD COLUMN IF NOT EXISTS ai_context_es TEXT;

-- Adicionar índices para melhorar performance de busca
CREATE INDEX IF NOT EXISTS idx_knowledge_contents_category_active 
ON knowledge_contents(category_id, active) 
WHERE active = true;

-- Comentários para documentação
COMMENT ON COLUMN knowledge_contents.ai_context IS 'Contexto técnico em português para modelos de IA generativa (SGE, ChatGPT, etc)';
COMMENT ON COLUMN knowledge_contents.ai_context_en IS 'Technical context in English for generative AI models';
COMMENT ON COLUMN knowledge_contents.ai_context_es IS 'Contexto técnico en español para modelos de IA generativa';