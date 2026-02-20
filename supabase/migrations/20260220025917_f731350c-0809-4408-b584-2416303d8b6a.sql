
-- Etapa 1a: Para registros numéricos com vídeos vinculados,
-- migrar o product_id dos vídeos para o registro UUID correspondente (mesmo nome)
UPDATE knowledge_videos kv
SET product_id = uuid_new.id
FROM system_a_catalog num_old
JOIN system_a_catalog uuid_new 
  ON uuid_new.name = num_old.name 
  AND uuid_new.source = num_old.source
  AND uuid_new.category = num_old.category
  AND uuid_new.external_id !~ '^[0-9]+$'  -- o UUID novo
WHERE kv.product_id = num_old.id
  AND num_old.category = 'product'
  AND num_old.external_id ~ '^[0-9]+$'    -- o numérico antigo
  AND num_old.name IN (
    SELECT name FROM system_a_catalog WHERE category = 'product' GROUP BY name HAVING COUNT(*) > 1
  );

-- Etapa 1b: Agora deletar os registros numéricos antigos (FK resolvida)
DELETE FROM system_a_catalog
WHERE category = 'product'
  AND external_id ~ '^[0-9]+$'
  AND name IN (
    SELECT name FROM system_a_catalog WHERE category = 'product' GROUP BY name HAVING COUNT(*) > 1
  );

-- Etapa 2: Índice único parcial para prevenir futuras duplicatas
CREATE UNIQUE INDEX IF NOT EXISTS idx_system_a_catalog_name_source_product
ON system_a_catalog (source, name)
WHERE category = 'product';
