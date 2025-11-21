-- Correção de URLs vazias no catálogo
-- Copiar slug para cta_1_url quando este estiver vazio

UPDATE system_a_catalog
SET 
  cta_1_url = slug,
  updated_at = now()
WHERE 
  (cta_1_url IS NULL OR cta_1_url = '')
  AND slug IS NOT NULL
  AND slug LIKE 'https://%';

-- Criar índice para busca rápida de produtos por nome
CREATE INDEX IF NOT EXISTS idx_system_a_catalog_name_trgm 
ON system_a_catalog 
USING gin (name gin_trgm_ops);

-- Criar índice para resinas
CREATE INDEX IF NOT EXISTS idx_resins_name_trgm 
ON resins 
USING gin (name gin_trgm_ops);

-- Comentários sobre a correção
COMMENT ON COLUMN system_a_catalog.cta_1_url IS 'URL do e-commerce para o produto. Preenchido automaticamente com slug quando vazio.';
