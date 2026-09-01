ALTER TABLE public.live_group_automations
  ADD COLUMN IF NOT EXISTS instance_names text[] NOT NULL DEFAULT '{}'::text[];