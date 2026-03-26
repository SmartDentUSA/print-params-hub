

# Plan: Generate PRODUCT_CATALOG_SCHEMA.md

## What

Create `/mnt/documents/PRODUCT_CATALOG_SCHEMA.md` documenting every field in the product catalog system.

## Content structure

### 1. Database table: `system_a_catalog` (32 columns)

| Section | Fields |
|---|---|
| **Identity** | `id` (uuid PK), `name` (text, required), `slug` (text), `external_id` (text, required), `source` (text, default 'manual'), `category` (text, required — 'product', 'resin', 'company_info', 'category_config') |
| **Taxonomy** | `product_category` (text), `product_subcategory` (text) |
| **Commercial** | `description` (text), `price` (numeric), `promo_price` (numeric), `currency` (text, default 'BRL'), `rating` (numeric), `review_count` (integer) |
| **Media** | `image_url` (text), `og_image_url` (text) |
| **CTAs** | `cta_1_label`, `cta_1_url`, `cta_1_description`, `cta_2_label`, `cta_2_url`, `cta_2_description`, `cta_3_label`, `cta_3_url`, `cta_3_description` (all text) |
| **SEO** | `seo_title_override` (text), `meta_description` (text), `canonical_url` (text), `keywords` (text[]), `keyword_ids` (text[]) |
| **Status** | `active` (bool), `approved` (bool), `visible_in_ui` (bool), `display_order` (integer) |
| **Extra** | `extra_data` (JSONB — variations, benefits, features, faqs arrays) |
| **Sync** | `last_sync_at` (timestamptz) |
| **Timestamps** | `created_at`, `updated_at` (timestamptz) |

### 2. Related table: `resin_documents` (24 columns)

Product documents (PDFs, IFUs) linked via `product_id` → `system_a_catalog.id`. Fields: `id`, `resin_id` (FK), `document_name`, `document_description`, `document_category`, `document_subcategory`, `document_type`, `file_url`, `file_name`, `file_size`, `file_hash`, `language`, `order_index`, `active`, `extracted_text`, `extracted_at`, `extraction_status`, `extraction_method`, `extraction_error`, `extraction_tokens`, `created_at`, `updated_at`.

### 3. Frontend interface: `CatalogProduct` (useCatalogCRUD.ts)

Map of TypeScript interface fields to DB columns.

### 4. UI Components (admin form)

- `AdminCatalogFormSection.tsx` — form fields: name, slug, category/subcategory (with datalist), description, price/promo_price, image_url (with preview), 3 CTAs, status switches (active/approved/visible_in_ui)
- `AdminModal.tsx` (type='catalog') — wraps form, handles SEO fields import, document management, Loja Integrada import
- `AdminCatalog.tsx` — list table with filters (search, category, status), image migration

### 5. Public consumers

- `ProductPage.tsx` — full product page with SEO, Schema.org, FAQs, variations, benefits
- `InlineProductCard.tsx` — embedded card in articles
- `useCatalogProducts.ts` — product name→slug map for article linking
- `useProductReviews.ts` — product data for review displays
- 12+ Edge Functions that read from `system_a_catalog`

## Execution

Single script to generate the .md file at `/mnt/documents/PRODUCT_CATALOG_SCHEMA.md`. No code changes.

