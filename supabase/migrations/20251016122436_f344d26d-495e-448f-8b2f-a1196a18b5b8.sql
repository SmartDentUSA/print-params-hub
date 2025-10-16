-- Add SEO description fields for CTAs in resins table
ALTER TABLE public.resins 
ADD COLUMN IF NOT EXISTS cta_1_description TEXT,
ADD COLUMN IF NOT EXISTS cta_2_description TEXT,
ADD COLUMN IF NOT EXISTS cta_3_description TEXT;

COMMENT ON COLUMN public.resins.cta_1_description IS 'SEO description for first CTA (max 200 chars) - invisible to users, used for aria-label and schema.org';
COMMENT ON COLUMN public.resins.cta_2_description IS 'SEO description for second CTA (max 200 chars) - invisible to users, used for aria-label and schema.org';
COMMENT ON COLUMN public.resins.cta_3_description IS 'SEO description for third CTA (max 200 chars) - invisible to users, used for aria-label and schema.org';