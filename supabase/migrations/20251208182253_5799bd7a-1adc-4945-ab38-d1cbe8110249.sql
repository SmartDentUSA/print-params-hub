-- Auto-preencher document_type em catalog_documents baseado no nome
UPDATE catalog_documents SET document_type = 
  CASE 
    WHEN document_name ILIKE '%perfil%' OR document_name ILIKE '%técnico%' OR document_name ILIKE '%tecnico%' THEN 'perfil_tecnico'
    WHEN document_name ILIKE '%ifu%' OR document_name ILIKE '%instrução%' OR document_name ILIKE '%instrucao%' OR document_name ILIKE '%instrucoes%' THEN 'ifu'
    WHEN document_name ILIKE '%guia%' OR document_name ILIKE '%workflow%' OR document_name ILIKE '%aplicação%' OR document_name ILIKE '%aplicacao%' THEN 'guia'
    WHEN document_name ILIKE '%fds%' OR document_name ILIKE '%fispq%' OR document_name ILIKE '%segurança%' OR document_name ILIKE '%safety%' THEN 'fds'
    WHEN document_name ILIKE '%laudo%' OR document_name ILIKE '%ensaio%' OR document_name ILIKE '%report%' OR document_name ILIKE '%teste%' THEN 'laudo'
    WHEN document_name ILIKE '%catálogo%' OR document_name ILIKE '%catalogo%' OR document_name ILIKE '%catalog%' THEN 'catalogo'
    ELSE document_type
  END
WHERE document_type IS NULL;

-- Auto-preencher document_type em resin_documents baseado no nome
UPDATE resin_documents SET document_type = 
  CASE 
    WHEN document_name ILIKE '%perfil%' OR document_name ILIKE '%técnico%' OR document_name ILIKE '%tecnico%' THEN 'perfil_tecnico'
    WHEN document_name ILIKE '%ifu%' OR document_name ILIKE '%instrução%' OR document_name ILIKE '%instrucao%' OR document_name ILIKE '%instrucoes%' THEN 'ifu'
    WHEN document_name ILIKE '%guia%' OR document_name ILIKE '%workflow%' OR document_name ILIKE '%aplicação%' OR document_name ILIKE '%aplicacao%' THEN 'guia'
    WHEN document_name ILIKE '%fds%' OR document_name ILIKE '%fispq%' OR document_name ILIKE '%segurança%' OR document_name ILIKE '%safety%' THEN 'fds'
    WHEN document_name ILIKE '%laudo%' OR document_name ILIKE '%ensaio%' OR document_name ILIKE '%report%' OR document_name ILIKE '%teste%' THEN 'laudo'
    WHEN document_name ILIKE '%catálogo%' OR document_name ILIKE '%catalogo%' OR document_name ILIKE '%catalog%' THEN 'catalogo'
    ELSE document_type
  END
WHERE document_type IS NULL;

-- Resetar cache para forçar re-extração com extrator correto
UPDATE catalog_documents SET 
  extracted_text = NULL,
  extraction_status = 'pending',
  extraction_method = NULL,
  extraction_error = NULL,
  extracted_at = NULL,
  extraction_tokens = NULL
WHERE document_type IS NOT NULL;

UPDATE resin_documents SET 
  extracted_text = NULL,
  extraction_status = 'pending',
  extraction_method = NULL,
  extraction_error = NULL,
  extracted_at = NULL,
  extraction_tokens = NULL
WHERE document_type IS NOT NULL;