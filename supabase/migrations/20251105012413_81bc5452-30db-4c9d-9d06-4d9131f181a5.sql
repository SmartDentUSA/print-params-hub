-- Corrigir slugs dos produtos existentes no system_a_catalog
-- Gera slugs limpos a partir dos nomes dos produtos

UPDATE system_a_catalog
SET slug = LOWER(
  REGEXP_REPLACE(
    REGEXP_REPLACE(
      TRANSLATE(
        name,
        'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
        'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN'
      ),
      '[^\w\s-]', '', 'g'
    ),
    '\s+', '-', 'g'
  )
),
updated_at = NOW()
WHERE category = 'product' 
  AND (slug IS NULL OR slug LIKE '%lojaintegrada%' OR slug LIKE '%http%');