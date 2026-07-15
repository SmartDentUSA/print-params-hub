
ALTER TABLE public.resins
  ADD COLUMN IF NOT EXISTS info_card_url_pt text,
  ADD COLUMN IF NOT EXISTS info_card_url_en text,
  ADD COLUMN IF NOT EXISTS info_card_url_es text,
  ADD COLUMN IF NOT EXISTS info_card_generated_at timestamptz;
