-- Primeiro, remover a constraint única no campo name se existir
ALTER TABLE resins DROP CONSTRAINT IF EXISTS resins_name_key;

-- Criar uma constraint única composta para name + manufacturer
ALTER TABLE resins ADD CONSTRAINT resins_name_manufacturer_unique UNIQUE (name, manufacturer);

-- Agora sincronizar as resinas
INSERT INTO resins (name, manufacturer, type, active)
SELECT DISTINCT
  ps.resin_name,
  ps.resin_manufacturer,
  'standard'::resin_type,
  true
FROM parameter_sets ps
WHERE ps.active = true
  AND ps.resin_name IS NOT NULL
  AND ps.resin_manufacturer IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM resins r 
    WHERE r.name = ps.resin_name 
    AND r.manufacturer = ps.resin_manufacturer
  )
ON CONFLICT (name, manufacturer) DO NOTHING;