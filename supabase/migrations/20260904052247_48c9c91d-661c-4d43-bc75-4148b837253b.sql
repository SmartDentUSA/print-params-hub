ALTER TABLE public.smartops_events
  ADD COLUMN IF NOT EXISTS marketing_art_url text,
  ADD COLUMN IF NOT EXISTS marketing_assets jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS marketing_assets_generated_at timestamptz;