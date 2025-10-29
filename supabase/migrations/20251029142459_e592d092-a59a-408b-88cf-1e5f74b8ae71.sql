-- ETAPA 1: Adicionar campos para CTA1 Toggle
ALTER TABLE resins 
ADD COLUMN IF NOT EXISTS cta_1_enabled boolean DEFAULT true;

-- ETAPA 2: Adicionar campos para CTA4 (Seletor Inteligente)
ALTER TABLE resins 
ADD COLUMN IF NOT EXISTS cta_4_label text,
ADD COLUMN IF NOT EXISTS cta_4_url text,
ADD COLUMN IF NOT EXISTS cta_4_description text,
ADD COLUMN IF NOT EXISTS cta_4_source_type text,
ADD COLUMN IF NOT EXISTS cta_4_source_id uuid;

-- ETAPA 3: Adicionar constraint para cta_4_source_type
ALTER TABLE resins
ADD CONSTRAINT cta_4_source_type_check 
CHECK (cta_4_source_type IS NULL OR cta_4_source_type IN ('manual', 'document', 'external_link', 'knowledge'));

-- ETAPA 4: Criar índice para melhor performance em queries de CTA4
CREATE INDEX IF NOT EXISTS idx_resins_cta_4_source ON resins(cta_4_source_type, cta_4_source_id) WHERE cta_4_source_id IS NOT NULL;

-- ETAPA 5: Comentários para documentação
COMMENT ON COLUMN resins.cta_1_enabled IS 'Toggle para ativar/desativar botão de e-commerce (CTA1)';
COMMENT ON COLUMN resins.cta_4_label IS 'Label do botão CTA4 (Seletor Inteligente)';
COMMENT ON COLUMN resins.cta_4_url IS 'URL final gerada para CTA4';
COMMENT ON COLUMN resins.cta_4_description IS 'Descrição SEO do CTA4';
COMMENT ON COLUMN resins.cta_4_source_type IS 'Tipo de fonte do CTA4: manual, document, external_link, knowledge';
COMMENT ON COLUMN resins.cta_4_source_id IS 'ID do recurso vinculado quando source_type não é manual';