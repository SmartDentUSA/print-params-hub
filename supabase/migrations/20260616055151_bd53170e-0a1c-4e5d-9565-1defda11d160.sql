
-- Add translation columns (_en/_es) to KB card tables
-- All idempotent via IF NOT EXISTS. No RLS changes.

-- system_a_catalog (products + resins source)
ALTER TABLE public.system_a_catalog
  ADD COLUMN IF NOT EXISTS name_en TEXT,
  ADD COLUMN IF NOT EXISTS name_es TEXT,
  ADD COLUMN IF NOT EXISTS description_en TEXT,
  ADD COLUMN IF NOT EXISTS description_es TEXT,
  ADD COLUMN IF NOT EXISTS product_category_en TEXT,
  ADD COLUMN IF NOT EXISTS product_category_es TEXT,
  ADD COLUMN IF NOT EXISTS product_subcategory_en TEXT,
  ADD COLUMN IF NOT EXISTS product_subcategory_es TEXT,
  ADD COLUMN IF NOT EXISTS cta_1_label_en TEXT,
  ADD COLUMN IF NOT EXISTS cta_1_label_es TEXT,
  ADD COLUMN IF NOT EXISTS cta_1_description_en TEXT,
  ADD COLUMN IF NOT EXISTS cta_1_description_es TEXT,
  ADD COLUMN IF NOT EXISTS cta_2_label_en TEXT,
  ADD COLUMN IF NOT EXISTS cta_2_label_es TEXT,
  ADD COLUMN IF NOT EXISTS technical_specs_en JSONB,
  ADD COLUMN IF NOT EXISTS technical_specs_es JSONB,
  ADD COLUMN IF NOT EXISTS translated_at_en TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS translated_at_es TIMESTAMPTZ;

-- resins
ALTER TABLE public.resins
  ADD COLUMN IF NOT EXISTS name_en TEXT,
  ADD COLUMN IF NOT EXISTS name_es TEXT,
  ADD COLUMN IF NOT EXISTS description_en TEXT,
  ADD COLUMN IF NOT EXISTS description_es TEXT,
  ADD COLUMN IF NOT EXISTS processing_instructions_en TEXT,
  ADD COLUMN IF NOT EXISTS processing_instructions_es TEXT,
  ADD COLUMN IF NOT EXISTS cta_1_label_en TEXT,
  ADD COLUMN IF NOT EXISTS cta_1_label_es TEXT,
  ADD COLUMN IF NOT EXISTS cta_2_label_en TEXT,
  ADD COLUMN IF NOT EXISTS cta_2_label_es TEXT,
  ADD COLUMN IF NOT EXISTS cta_3_label_en TEXT,
  ADD COLUMN IF NOT EXISTS cta_3_label_es TEXT,
  ADD COLUMN IF NOT EXISTS cta_4_label_en TEXT,
  ADD COLUMN IF NOT EXISTS cta_4_label_es TEXT,
  ADD COLUMN IF NOT EXISTS technical_specs_en JSONB,
  ADD COLUMN IF NOT EXISTS technical_specs_es JSONB,
  ADD COLUMN IF NOT EXISTS translated_at_en TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS translated_at_es TIMESTAMPTZ;

-- products_catalog (source of technical_specifications)
ALTER TABLE public.products_catalog
  ADD COLUMN IF NOT EXISTS technical_specifications_en JSONB,
  ADD COLUMN IF NOT EXISTS technical_specifications_es JSONB,
  ADD COLUMN IF NOT EXISTS translated_at_en TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS translated_at_es TIMESTAMPTZ;

-- knowledge_videos
ALTER TABLE public.knowledge_videos
  ADD COLUMN IF NOT EXISTS title_en TEXT,
  ADD COLUMN IF NOT EXISTS title_es TEXT,
  ADD COLUMN IF NOT EXISTS description_en TEXT,
  ADD COLUMN IF NOT EXISTS description_es TEXT,
  ADD COLUMN IF NOT EXISTS translated_at_en TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS translated_at_es TIMESTAMPTZ;

-- distributors
ALTER TABLE public.distributors
  ADD COLUMN IF NOT EXISTS name_en TEXT,
  ADD COLUMN IF NOT EXISTS name_es TEXT,
  ADD COLUMN IF NOT EXISTS description_en TEXT,
  ADD COLUMN IF NOT EXISTS description_es TEXT,
  ADD COLUMN IF NOT EXISTS region_en TEXT,
  ADD COLUMN IF NOT EXISTS region_es TEXT,
  ADD COLUMN IF NOT EXISTS specialty_en TEXT,
  ADD COLUMN IF NOT EXISTS specialty_es TEXT,
  ADD COLUMN IF NOT EXISTS translated_at_en TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS translated_at_es TIMESTAMPTZ;

-- smartops_events
ALTER TABLE public.smartops_events
  ADD COLUMN IF NOT EXISTS title_en TEXT,
  ADD COLUMN IF NOT EXISTS title_es TEXT,
  ADD COLUMN IF NOT EXISTS description_en TEXT,
  ADD COLUMN IF NOT EXISTS description_es TEXT,
  ADD COLUMN IF NOT EXISTS location_en TEXT,
  ADD COLUMN IF NOT EXISTS location_es TEXT,
  ADD COLUMN IF NOT EXISTS translated_at_en TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS translated_at_es TIMESTAMPTZ;

-- knowledge_categories
ALTER TABLE public.knowledge_categories
  ADD COLUMN IF NOT EXISTS name_en TEXT,
  ADD COLUMN IF NOT EXISTS name_es TEXT,
  ADD COLUMN IF NOT EXISTS description_en TEXT,
  ADD COLUMN IF NOT EXISTS description_es TEXT,
  ADD COLUMN IF NOT EXISTS translated_at_en TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS translated_at_es TIMESTAMPTZ;
