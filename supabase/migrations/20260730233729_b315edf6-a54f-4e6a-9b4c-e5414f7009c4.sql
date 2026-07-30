ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS evolution_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS evolution_status text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS evolution_last_check_at timestamptz,
  ADD COLUMN IF NOT EXISTS evo_go_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS evo_go_status text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS evo_go_last_check_at timestamptz;

-- Backfill: preserva comportamento legado dos membros já configurados
UPDATE public.team_members
   SET evolution_enabled = true
 WHERE evolution_instance_name IS NOT NULL AND evolution_api_key IS NOT NULL;

UPDATE public.team_members
   SET evo_go_enabled = true
 WHERE evo_go_instance_token IS NOT NULL;

ALTER TABLE public.wa_message_queue
  ADD COLUMN IF NOT EXISTS blocked_provider text;