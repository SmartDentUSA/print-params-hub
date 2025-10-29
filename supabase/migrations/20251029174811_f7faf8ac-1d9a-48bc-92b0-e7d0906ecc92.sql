-- Atualizar CTAs de documentos para usar o caminho /docs/

-- CTA 2: atualizar URLs para formato /docs/<filename>
UPDATE resins r
SET cta_2_url = '/docs/' || regexp_replace(rd.file_url, '^.*/([^/]+)$', '\1')
FROM resin_documents rd
WHERE r.cta_2_source_type = 'document'
  AND r.cta_2_source_id = rd.id
  AND (r.cta_2_url IS NULL OR r.cta_2_url NOT LIKE '/docs/%');

-- CTA 3: atualizar URLs para formato /docs/<filename>
UPDATE resins r
SET cta_3_url = '/docs/' || regexp_replace(rd.file_url, '^.*/([^/]+)$', '\1')
FROM resin_documents rd
WHERE r.cta_3_source_type = 'document'
  AND r.cta_3_source_id = rd.id
  AND (r.cta_3_url IS NULL OR r.cta_3_url NOT LIKE '/docs/%');

-- CTA 4: atualizar URLs para formato /docs/<filename>
UPDATE resins r
SET cta_4_url = '/docs/' || regexp_replace(rd.file_url, '^.*/([^/]+)$', '\1')
FROM resin_documents rd
WHERE r.cta_4_source_type = 'document'
  AND r.cta_4_source_id = rd.id
  AND (r.cta_4_url IS NULL OR r.cta_4_url NOT LIKE '/docs/%');