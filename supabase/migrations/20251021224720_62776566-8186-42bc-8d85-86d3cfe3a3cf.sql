-- Adicionar canonical URLs aos produtos do catálogo
UPDATE system_a_catalog
SET canonical_url = 'https://parametros.smartdent.com.br/produtos/' || slug
WHERE category = 'product'
  AND slug IS NOT NULL
  AND (canonical_url IS NULL OR canonical_url = '');