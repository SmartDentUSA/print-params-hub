ALTER TABLE public.lia_attendances
  ADD COLUMN IF NOT EXISTS prof_contract_sources jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS prof_ai_summary text,
  ADD COLUMN IF NOT EXISTS prof_ai_summary_at timestamptz;