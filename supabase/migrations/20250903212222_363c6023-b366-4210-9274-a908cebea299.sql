-- Corrigir parâmetros do Moonray S com cure_time = 0 para valores padrão baseados na altura da camada
UPDATE parameter_sets 
SET cure_time = CASE 
  WHEN layer_height <= 0.025 THEN 8
  WHEN layer_height <= 0.05 THEN 6  
  WHEN layer_height <= 0.1 THEN 4
  ELSE 3
END,
updated_at = now()
WHERE model_slug = 'moonray-s' 
  AND cure_time = 0;