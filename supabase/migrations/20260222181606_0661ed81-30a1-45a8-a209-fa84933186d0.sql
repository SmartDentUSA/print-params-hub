
-- Update resins: copy system_a_product_url to cta_1
UPDATE resins 
SET cta_1_label = 'Loja', 
    cta_1_url = system_a_product_url, 
    cta_1_enabled = true 
WHERE active = true 
  AND system_a_product_url IS NOT NULL 
  AND (cta_1_url IS NULL OR cta_1_url = '');

-- Update catalog products with full URL in slug
UPDATE system_a_catalog 
SET cta_1_label = 'Loja', 
    cta_1_url = slug
WHERE active = true 
  AND approved = true 
  AND category = 'product'
  AND slug LIKE 'https://%'
  AND (cta_1_url IS NULL OR cta_1_url = '');

-- Update catalog products with partial slug (prepend base URL)
UPDATE system_a_catalog 
SET cta_1_label = 'Loja', 
    cta_1_url = 'https://loja.smartdent.com.br/' || slug
WHERE active = true 
  AND approved = true 
  AND category = 'product'
  AND slug IS NOT NULL
  AND slug NOT LIKE 'https://%'
  AND slug != ''
  AND slug != 'a-'
  AND (cta_1_url IS NULL OR cta_1_url = '');
