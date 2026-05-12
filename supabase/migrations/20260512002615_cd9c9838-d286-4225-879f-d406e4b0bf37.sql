ALTER TABLE public.team_members DROP CONSTRAINT IF EXISTS team_members_role_check;
ALTER TABLE public.team_members
  ADD CONSTRAINT team_members_role_check
  CHECK (role = ANY (ARRAY['vendedor'::text, 'cs'::text, 'suporte'::text, 'lia_comms'::text]));

UPDATE public.team_members
SET
  nome_completo = 'Patricia Gastaldi',
  role = 'lia_comms',
  ativo = true,
  updated_at = now()
WHERE piperun_owner_id::text = '47675';