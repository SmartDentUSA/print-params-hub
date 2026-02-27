
-- Add Astron Members columns to lia_attendances
ALTER TABLE public.lia_attendances
  ADD COLUMN IF NOT EXISTS astron_user_id integer,
  ADD COLUMN IF NOT EXISTS astron_status text,
  ADD COLUMN IF NOT EXISTS astron_nome text,
  ADD COLUMN IF NOT EXISTS astron_email text,
  ADD COLUMN IF NOT EXISTS astron_phone text,
  ADD COLUMN IF NOT EXISTS astron_plans_active text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS astron_plans_data jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS astron_courses_access jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS astron_courses_total integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS astron_courses_completed integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS astron_login_url text,
  ADD COLUMN IF NOT EXISTS astron_created_at timestamptz,
  ADD COLUMN IF NOT EXISTS astron_last_login_at timestamptz,
  ADD COLUMN IF NOT EXISTS astron_synced_at timestamptz;

-- Index for astron_user_id lookups
CREATE INDEX IF NOT EXISTS idx_lia_astron_user_id ON public.lia_attendances(astron_user_id) WHERE astron_user_id IS NOT NULL;
