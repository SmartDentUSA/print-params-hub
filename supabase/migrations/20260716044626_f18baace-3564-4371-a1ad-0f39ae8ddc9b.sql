ALTER TABLE public.resins
  ADD COLUMN IF NOT EXISTS image_background_removed_url text,
  ADD COLUMN IF NOT EXISTS image_urls jsonb,
  ADD COLUMN IF NOT EXISTS info_card_plan_pt jsonb,
  ADD COLUMN IF NOT EXISTS info_card_plan_en jsonb,
  ADD COLUMN IF NOT EXISTS info_card_plan_es jsonb;