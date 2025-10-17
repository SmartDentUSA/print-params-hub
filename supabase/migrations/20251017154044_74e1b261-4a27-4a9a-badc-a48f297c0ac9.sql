-- Adicionar coluna recommended_resins para CTAs de conversão
ALTER TABLE knowledge_contents 
ADD COLUMN recommended_resins UUID[] DEFAULT NULL;

-- Comentário para documentação
COMMENT ON COLUMN knowledge_contents.recommended_resins IS 'Array de UUIDs das resinas recomendadas no artigo (foreign key para resins.id)';