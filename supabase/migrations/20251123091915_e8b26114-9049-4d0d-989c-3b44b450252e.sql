-- Adicionar campo processing_instructions à tabela resins
ALTER TABLE resins 
ADD COLUMN processing_instructions TEXT;

COMMENT ON COLUMN resins.processing_instructions IS 
'Instruções de pré e pós processamento da resina (ex: tempo de lavagem IPA, temperatura de pós-cura, etc)';