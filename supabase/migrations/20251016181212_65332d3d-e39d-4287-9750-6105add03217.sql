-- 1. Remover parameter_sets duplicados (mantém apenas o mais recente de cada combinação)
DELETE FROM parameter_sets
WHERE id IN (
  SELECT id
  FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY brand_slug, model_slug, 
                         LOWER(resin_name), LOWER(resin_manufacturer), 
                         layer_height
             ORDER BY created_at DESC
           ) as rn
    FROM parameter_sets
    WHERE LOWER(resin_name) = 'smart print model l''aqua'
      AND resin_manufacturer = 'Smart Dent'
  ) t
  WHERE rn > 1
);

-- 2. Atualizar os parameter_sets restantes para usar capitalização consistente
UPDATE parameter_sets 
SET resin_name = 'Smart Print Model L''Aqua'
WHERE LOWER(resin_name) = 'smart print model l''aqua' 
  AND resin_manufacturer = 'Smart Dent';

-- 3. Deletar a resina duplicada (versão minúscula)
DELETE FROM resins 
WHERE id = 'b8e7cb0c-eb62-4554-b897-f4d9d8ea03d0';