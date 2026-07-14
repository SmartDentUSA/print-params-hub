ALTER TABLE public.system_a_catalog
  ADD COLUMN IF NOT EXISTS presentation text,
  ADD COLUMN IF NOT EXISTS presentation_qty numeric,
  ADD COLUMN IF NOT EXISTS quantity_multiplier numeric;