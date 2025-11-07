
-- MIGRAÇÃO DE DADOS: Consolidação de resinas duplicadas Smart Print Denture
-- Esta é uma operação de dados, não de schema

-- FASE 1: Migrar os 2 parâmetros de "Smart Print Denture" para "Smart Print Bio Denture (Rosa)"
UPDATE parameter_sets
SET 
  resin_name = 'Smart Print Bio Denture (Rosa)',
  updated_at = now()
WHERE id IN (
  '8e743cc9-254f-40a7-9084-9861938281be',  -- Elegoo Mars 4 Ultra
  'c3ce3857-b2f0-47ff-a714-79f7c0cec122'   -- Elegoo Mars 5 Ultra
)
AND active = true;

-- FASE 2: Desativar a resina duplicada (soft delete)
UPDATE resins
SET 
  active = false,
  updated_at = now()
WHERE id = '00a45791-d15e-4ae4-9098-804e457264f6'
AND name = 'Smart Print Denture'
AND manufacturer = 'Smart Dent';
