-- Sincronizar resinas únicas da tabela parameter_sets para a tabela resins
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
  );