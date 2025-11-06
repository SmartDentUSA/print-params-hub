-- Add multilingual content columns to knowledge_contents table
ALTER TABLE knowledge_contents
ADD COLUMN IF NOT EXISTS content_html_es TEXT,
ADD COLUMN IF NOT EXISTS content_html_en TEXT,
ADD COLUMN IF NOT EXISTS faqs_es JSONB,
ADD COLUMN IF NOT EXISTS faqs_en JSONB;