ALTER TABLE public.resins
  ADD COLUMN IF NOT EXISTS info_card_status text NOT NULL DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS info_card_error text,
  ADD COLUMN IF NOT EXISTS info_card_started_at timestamptz;