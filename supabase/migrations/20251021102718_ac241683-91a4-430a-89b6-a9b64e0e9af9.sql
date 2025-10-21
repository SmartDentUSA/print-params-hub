-- Add columns for AI prompt template and content hero image
ALTER TABLE public.knowledge_contents 
ADD COLUMN IF NOT EXISTS ai_prompt_template TEXT,
ADD COLUMN IF NOT EXISTS content_image_url TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.knowledge_contents.ai_prompt_template IS 'Custom AI prompt template for content generation';
COMMENT ON COLUMN public.knowledge_contents.content_image_url IS 'Hero image URL for article cards and content header';