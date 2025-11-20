-- Adicionar campos de cache de extração em resin_documents
ALTER TABLE resin_documents 
ADD COLUMN IF NOT EXISTS extracted_text TEXT,
ADD COLUMN IF NOT EXISTS extracted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS extraction_method TEXT,
ADD COLUMN IF NOT EXISTS extraction_tokens INTEGER,
ADD COLUMN IF NOT EXISTS extraction_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS extraction_error TEXT,
ADD COLUMN IF NOT EXISTS file_hash TEXT;

-- Adicionar campos de cache de extração em catalog_documents
ALTER TABLE catalog_documents 
ADD COLUMN IF NOT EXISTS extracted_text TEXT,
ADD COLUMN IF NOT EXISTS extracted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS extraction_method TEXT,
ADD COLUMN IF NOT EXISTS extraction_tokens INTEGER,
ADD COLUMN IF NOT EXISTS extraction_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS extraction_error TEXT,
ADD COLUMN IF NOT EXISTS file_hash TEXT;

-- Índices para melhorar performance
CREATE INDEX IF NOT EXISTS idx_resin_docs_extraction_status 
ON resin_documents(extraction_status);

CREATE INDEX IF NOT EXISTS idx_catalog_docs_extraction_status 
ON catalog_documents(extraction_status);

-- Comentários
COMMENT ON COLUMN resin_documents.extracted_text IS 'Texto extraído do PDF via IA (cache)';
COMMENT ON COLUMN resin_documents.extraction_status IS 'pending, processing, completed, failed';
COMMENT ON COLUMN resin_documents.file_hash IS 'Hash MD5 do arquivo para detectar mudanças';

COMMENT ON COLUMN catalog_documents.extracted_text IS 'Texto extraído do PDF via IA (cache)';
COMMENT ON COLUMN catalog_documents.extraction_status IS 'pending, processing, completed, failed';
COMMENT ON COLUMN catalog_documents.file_hash IS 'Hash MD5 do arquivo para detectar mudanças';