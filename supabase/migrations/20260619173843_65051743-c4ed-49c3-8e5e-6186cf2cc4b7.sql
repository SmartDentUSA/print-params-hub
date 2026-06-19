ALTER TABLE public.distributors
  ADD COLUMN IF NOT EXISTS service_areas jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS linhas_representadas text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS wikidata_id text,
  ADD COLUMN IF NOT EXISTS language_preference text NOT NULL DEFAULT 'pt',
  ADD COLUMN IF NOT EXISTS backlink_url text,
  ADD COLUMN IF NOT EXISTS backlink_status text,
  ADD COLUMN IF NOT EXISTS backlink_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS backlink_last_error text;

CREATE INDEX IF NOT EXISTS idx_distributors_backlink_status ON public.distributors(backlink_status);
CREATE INDEX IF NOT EXISTS idx_distributors_service_areas_gin ON public.distributors USING gin (service_areas);