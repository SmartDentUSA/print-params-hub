CREATE OR REPLACE FUNCTION public.fn_can_use_copilot(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT _user_id IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM auth.users au
      JOIN public.team_members tm ON lower(tm.email) = lower(au.email)
      WHERE au.id = _user_id AND tm.ativo = true AND tm.role = 'marketing'
        AND au.email_confirmed_at IS NOT NULL
    )
  )
$$;
REVOKE ALL ON FUNCTION public.fn_can_use_copilot(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.fn_can_use_copilot(uuid) TO authenticated, service_role;

CREATE TABLE public.copilot_pending_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  summary text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  result jsonb,
  error text,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '2 hours',
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.copilot_pending_actions TO service_role;
ALTER TABLE public.copilot_pending_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "copilot_pending_actions_service_only" ON public.copilot_pending_actions
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX copilot_pending_actions_user_idx ON public.copilot_pending_actions (user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.fn_copilot_pending_actions_validate()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('pending','executing','executed','cancelled','failed','expired') THEN
    RAISE EXCEPTION 'status inválido: %', NEW.status;
  END IF;
  IF NEW.action_type NOT IN ('promo_table','wa_group_campaign') THEN
    RAISE EXCEPTION 'tipo de ação inválido: %', NEW.action_type;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER trg_copilot_pending_actions_validate
  BEFORE INSERT OR UPDATE ON public.copilot_pending_actions
  FOR EACH ROW EXECUTE FUNCTION public.fn_copilot_pending_actions_validate();