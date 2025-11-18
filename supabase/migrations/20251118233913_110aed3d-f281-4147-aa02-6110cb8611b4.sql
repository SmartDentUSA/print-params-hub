-- Adicionar coluna para produtos recomendados do catálogo
ALTER TABLE knowledge_contents 
ADD COLUMN recommended_products uuid[] DEFAULT '{}';

-- Comentário explicativo
COMMENT ON COLUMN knowledge_contents.recommended_products IS 
'IDs de produtos do system_a_catalog recomendados para CTAs de conversão';