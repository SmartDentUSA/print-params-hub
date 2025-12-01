-- FASE 1: Correções Críticas GEO
-- Preencher slugs das 3 resinas Miicraft que estão faltando
-- Execute este script no SQL Editor do Supabase

UPDATE resins 
SET slug = 'miicraft-bv-012' 
WHERE name = 'Miicraft BV-012' AND slug IS NULL;

UPDATE resins 
SET slug = 'miicraft-bv-013a' 
WHERE name = 'Miicraft BV-013A' AND slug IS NULL;

UPDATE resins 
SET slug = 'miicraft-bv-014' 
WHERE name = 'Miicraft BV-014' AND slug IS NULL;

-- Verificar resultado
SELECT name, slug 
FROM resins 
WHERE name LIKE 'Miicraft BV-%'
ORDER BY name;
