-- Corrigir slugs problemáticos no system_a_catalog
UPDATE system_a_catalog
SET slug = LOWER(
  REGEXP_REPLACE(
    REGEXP_REPLACE(
      REGEXP_REPLACE(
        REGEXP_REPLACE(
          REGEXP_REPLACE(
            REGEXP_REPLACE(name, '[áàâãäå]', 'a', 'g'),
            '[éèêë]', 'e', 'g'
          ),
          '[íìîï]', 'i', 'g'
        ),
        '[óòôõö]', 'o', 'g'
      ),
      '[úùûü]', 'u', 'g'
    ),
    '[^a-z0-9\s-]', '', 'g'
  )
)
WHERE category = 'product'
  AND (slug IS NULL OR slug ~ '[^a-z0-9-]' OR slug LIKE '%http%');