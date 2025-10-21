-- Corrigir constraint da tabela system_a_catalog
-- Remove constraint incorreta que permitia apenas 1 registro por external_id
-- Adiciona constraint correta que permite múltiplos sources com mesmo external_id

-- 1. Remover constraint antiga (se existir)
ALTER TABLE system_a_catalog 
DROP CONSTRAINT IF EXISTS system_a_catalog_external_id_key;

-- 2. Adicionar constraint correta (source + external_id devem ser únicos juntos)
ALTER TABLE system_a_catalog 
ADD CONSTRAINT system_a_catalog_source_external_id_key 
UNIQUE (source, external_id);

-- 3. Criar índice para melhorar performance de queries por source
CREATE INDEX IF NOT EXISTS idx_system_a_catalog_source 
ON system_a_catalog(source);

-- 4. Criar índice para melhorar performance de queries por category
CREATE INDEX IF NOT EXISTS idx_system_a_catalog_category 
ON system_a_catalog(category);

COMMENT ON CONSTRAINT system_a_catalog_source_external_id_key ON system_a_catalog IS 
'Permite que diferentes sources (system_a, system_b) tenham o mesmo external_id, mas a combinação (source, external_id) deve ser única';