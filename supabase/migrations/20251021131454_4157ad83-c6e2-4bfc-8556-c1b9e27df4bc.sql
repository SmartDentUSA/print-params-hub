-- Add alt text column for hero images in knowledge contents
ALTER TABLE knowledge_contents 
ADD COLUMN content_image_alt TEXT;

COMMENT ON COLUMN knowledge_contents.content_image_alt IS 'Alternative text for the hero image (for SEO and accessibility)';