-- Etapa 1: Corrigir slugs que estão como URLs completas
UPDATE system_a_catalog
SET slug = LOWER(REGEXP_REPLACE(
  REGEXP_REPLACE(
    REGEXP_REPLACE(name, '[áàãâä]', 'a', 'gi'),
    '[éèêë]', 'e', 'gi'
  ),
  '[^a-z0-9\s-]', '', 'g'
))
WHERE slug IS NULL OR slug LIKE 'https://%' OR slug = '';

-- Remover espaços e substituir por hífens
UPDATE system_a_catalog
SET slug = REGEXP_REPLACE(
  REGEXP_REPLACE(slug, '\s+', '-', 'g'),
  '-+', '-', 'g'
)
WHERE slug LIKE '% %';

-- Etapa 2: Preencher CTAs vazios com links funcionais
UPDATE system_a_catalog
SET 
  cta_1_label = 'Ver na Loja',
  cta_1_url = CASE
    WHEN category = 'product' THEN 'https://loja.smartdent.com.br/produto/' || slug
    ELSE slug
  END,
  cta_1_description = 'Confira este produto na loja oficial Smart Dent'
WHERE category = 'product'
  AND (cta_1_url IS NULL OR cta_1_url = '')
  AND slug IS NOT NULL;

-- Etapa 3: Gerar meta descriptions automáticas
UPDATE system_a_catalog
SET meta_description = LEFT(description, 155) || '...'
WHERE meta_description IS NULL 
  AND description IS NOT NULL
  AND LENGTH(description) > 50;

-- Etapa 4: Usar image_url como og_image_url quando vazio
UPDATE system_a_catalog
SET og_image_url = image_url
WHERE og_image_url IS NULL 
  AND image_url IS NOT NULL;

-- Etapa 5: Gerar títulos SEO quando vazios
UPDATE system_a_catalog
SET seo_title_override = name || ' | Smart Dent'
WHERE seo_title_override IS NULL 
  AND name IS NOT NULL;