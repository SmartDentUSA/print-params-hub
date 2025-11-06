-- Add translated title and excerpt columns to knowledge_contents
ALTER TABLE knowledge_contents
ADD COLUMN title_es TEXT,
ADD COLUMN title_en TEXT,
ADD COLUMN excerpt_es TEXT,
ADD COLUMN excerpt_en TEXT;

COMMENT ON COLUMN knowledge_contents.title_es IS 'Article title in Spanish';
COMMENT ON COLUMN knowledge_contents.title_en IS 'Article title in English';
COMMENT ON COLUMN knowledge_contents.excerpt_es IS 'Article excerpt in Spanish (max 160 chars)';
COMMENT ON COLUMN knowledge_contents.excerpt_en IS 'Article excerpt in English (max 160 chars)';