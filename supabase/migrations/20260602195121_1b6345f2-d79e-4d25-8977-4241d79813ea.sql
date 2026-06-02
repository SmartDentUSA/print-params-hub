
ALTER TABLE public.social_sequences
  ADD COLUMN IF NOT EXISTS audience_source text DEFAULT 'social_contacts',
  ADD COLUMN IF NOT EXISTS audience_filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS audience_contact_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS audience_count integer NOT NULL DEFAULT 0;
