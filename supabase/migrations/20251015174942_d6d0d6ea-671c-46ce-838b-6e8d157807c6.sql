-- Passo 1: Deletar parameter_sets com fabricantes que serão removidos
-- (ao invés de atualizá-los para evitar duplicatas)
DELETE FROM parameter_sets 
WHERE LOWER(TRIM(resin_manufacturer)) IN ('50 microns', '25 microns');

-- Passo 2: Deletar todas as resinas que não são Smart Dent
DELETE FROM resins 
WHERE LOWER(TRIM(manufacturer)) != 'smart dent';