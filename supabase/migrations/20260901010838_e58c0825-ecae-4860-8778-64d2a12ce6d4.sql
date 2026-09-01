ALTER TABLE public.smartops_events
  ADD COLUMN IF NOT EXISTS speakers jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS partner_brands jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS instagram_handle text;