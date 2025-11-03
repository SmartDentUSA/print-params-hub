-- Adicionar campos de correlação na tabela resins
-- Estes campos permitem vincular produtos entre diferentes sistemas

-- Campo 1: external_id (ID da Loja Integrada)
ALTER TABLE resins 
ADD COLUMN IF NOT EXISTS external_id TEXT;

-- Campo 2: system_a_product_id (UUID do Sistema A)
ALTER TABLE resins 
ADD COLUMN IF NOT EXISTS system_a_product_id UUID;

-- Campo 3: system_a_product_url (URL canônica do produto)
ALTER TABLE resins 
ADD COLUMN IF NOT EXISTS system_a_product_url TEXT;

-- Criar índices para buscas rápidas
CREATE INDEX IF NOT EXISTS idx_resins_external_id 
ON resins(external_id) WHERE external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_resins_system_a_product_id 
ON resins(system_a_product_id) WHERE system_a_product_id IS NOT NULL;

-- Adicionar unique constraints para prevenir duplicatas
ALTER TABLE resins 
ADD CONSTRAINT unique_resins_external_id 
UNIQUE (external_id);

ALTER TABLE resins 
ADD CONSTRAINT unique_resins_system_a_product_id 
UNIQUE (system_a_product_id);

-- Comentários explicativos
COMMENT ON COLUMN resins.external_id IS 'ID do produto na Loja Integrada (ex: 365210617)';
COMMENT ON COLUMN resins.system_a_product_id IS 'UUID do produto no Sistema A (ex: 832fa3e7-b24c-471f-966e-4ded6270fa67)';
COMMENT ON COLUMN resins.system_a_product_url IS 'URL canônica do produto (ex: https://loja.smartdent.com.br/resina-3d-smart-print-model-plus)';