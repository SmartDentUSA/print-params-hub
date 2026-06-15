---
name: Resinas Canonical Mirror
description: Resins table is canonical source; system_a_catalog mirrors content; docs stay separate
type: feature
---
# Resinas: Canonical Mirror Policy

- **Fonte canônica**: `public.resins` (UI: Configurações > Configurações do Sistema > Resinas).
- **Espelho público**: `public.system_a_catalog` (cards com `product_category ILIKE '%resina%'`).
  - O catálogo controla **somente** visibilidade pública e taxonomia: `active`, `approved`, `visible_in_ui`, `display_order`, `slug`, `name`, `category`, `product_category`, `product_subcategory`, `price/promo_price/currency`.
  - Todo o resto (description, image_url, SEO, CTAs 1–3, technical_specs, clinical_indications, contraindications, compatibility_list, certifications, wikidata_qid) é **espelhado** de `resins` com COALESCE — nunca apaga dado existente do catálogo.
- **Documentos NUNCA são unificados**: `resin_documents` (resin_id) e `catalog_documents` (product_id) são tabelas independentes; preservar os file paths.
- **Match resin→catalog**: por `slug` (com traços finais removidos via `regexp_replace(slug,'-+$','')`), depois fallback por nome (catalog name termina com resin name, ou vice-versa, case-insensitive). Quando há duplicata `category='resin'` (legada) + `category='product'`, espelhar apenas a linha `product`.
- **Re-rodar a unificação**: o UPDATE com COALESCE é idempotente; aplicar sempre que a `resins` for atualizada se não houver trigger automático.