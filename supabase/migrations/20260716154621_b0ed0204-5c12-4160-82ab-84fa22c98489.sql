ALTER TABLE public.lia_attendances 
ADD COLUMN IF NOT EXISTS phone_normalized_backfilled_at TIMESTAMPTZ NULL;