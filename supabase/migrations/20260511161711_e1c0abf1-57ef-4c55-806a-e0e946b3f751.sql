ALTER TABLE public.lia_attendances
  ADD COLUMN IF NOT EXISTS last_seller_note_hash text,
  ADD COLUMN IF NOT EXISTS last_seller_note_at timestamptz;