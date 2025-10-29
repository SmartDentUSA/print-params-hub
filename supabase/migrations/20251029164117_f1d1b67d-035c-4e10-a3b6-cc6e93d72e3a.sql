-- CTA 2 - Adicionar campos inteligentes
ALTER TABLE resins 
ADD COLUMN IF NOT EXISTS cta_2_source_type text CHECK (cta_2_source_type IN ('manual', 'document', 'external_link', 'knowledge')),
ADD COLUMN IF NOT EXISTS cta_2_source_id uuid;

-- CTA 3 - Adicionar campos inteligentes
ALTER TABLE resins 
ADD COLUMN IF NOT EXISTS cta_3_source_type text CHECK (cta_3_source_type IN ('manual', 'document', 'external_link', 'knowledge')),
ADD COLUMN IF NOT EXISTS cta_3_source_id uuid;

-- Comentários para documentação
COMMENT ON COLUMN resins.cta_2_source_type IS 'Tipo de fonte do CTA 2: manual, document, external_link, knowledge';
COMMENT ON COLUMN resins.cta_2_source_id IS 'ID do recurso vinculado quando source_type não for manual';
COMMENT ON COLUMN resins.cta_3_source_type IS 'Tipo de fonte do CTA 3: manual, document, external_link, knowledge';
COMMENT ON COLUMN resins.cta_3_source_id IS 'ID do recurso vinculado quando source_type não for manual';