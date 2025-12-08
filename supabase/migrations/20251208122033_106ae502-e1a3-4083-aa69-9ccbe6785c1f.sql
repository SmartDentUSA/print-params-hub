-- Adicionar campos de metadados para documentos de resinas
ALTER TABLE resin_documents
  ADD COLUMN IF NOT EXISTS language text DEFAULT 'pt',
  ADD COLUMN IF NOT EXISTS document_category text,
  ADD COLUMN IF NOT EXISTS document_subcategory text,
  ADD COLUMN IF NOT EXISTS document_type text;

-- Adicionar campos de metadados para documentos de catálogo
ALTER TABLE catalog_documents
  ADD COLUMN IF NOT EXISTS language text DEFAULT 'pt',
  ADD COLUMN IF NOT EXISTS document_category text,
  ADD COLUMN IF NOT EXISTS document_subcategory text,
  ADD COLUMN IF NOT EXISTS document_type text;

-- Criar índices para melhorar performance de buscas
CREATE INDEX IF NOT EXISTS idx_resin_documents_language ON resin_documents(language);
CREATE INDEX IF NOT EXISTS idx_resin_documents_document_type ON resin_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_catalog_documents_language ON catalog_documents(language);
CREATE INDEX IF NOT EXISTS idx_catalog_documents_document_type ON catalog_documents(document_type);