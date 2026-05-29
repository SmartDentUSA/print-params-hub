ALTER TABLE public.team_members
ADD COLUMN IF NOT EXISTS evolution_lid text;

CREATE INDEX IF NOT EXISTS idx_team_members_evolution_instance_lid
ON public.team_members (evolution_instance_name, evolution_lid)
WHERE evolution_instance_name IS NOT NULL AND evolution_lid IS NOT NULL;