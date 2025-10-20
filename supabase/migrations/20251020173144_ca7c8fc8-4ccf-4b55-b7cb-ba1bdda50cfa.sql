-- Fase 1: Adicionar campos de SEO invisíveis à tabela resins
-- Estes campos serão usados apenas para enriquecimento automático de HTML/Schema.org

ALTER TABLE resins
ADD COLUMN IF NOT EXISTS meta_description TEXT,
ADD COLUMN IF NOT EXISTS og_image_url TEXT,
ADD COLUMN IF NOT EXISTS keywords TEXT[];

-- Criar índice GIN para busca eficiente por keywords
CREATE INDEX IF NOT EXISTS idx_resins_keywords ON resins USING GIN (keywords);

-- Comentários explicativos
COMMENT ON COLUMN resins.meta_description IS 'Meta description otimizada para SEO (importada do Sistema A)';
COMMENT ON COLUMN resins.og_image_url IS 'URL da imagem Open Graph para compartilhamento social (importada do Sistema A)';
COMMENT ON COLUMN resins.keywords IS 'Array de palavras-chave para SEO e busca (importada do Sistema A)';