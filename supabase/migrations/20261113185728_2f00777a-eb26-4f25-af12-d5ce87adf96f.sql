CREATE OR REPLACE FUNCTION public.fn_can_use_lead_dossier(_user_id uuid)
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
      WHERE au.id = _user_id AND tm.ativo = true AND tm.role = 'vendedor'
        AND au.email_confirmed_at IS NOT NULL
    )
  )
$$;
REVOKE ALL ON FUNCTION public.fn_can_use_lead_dossier(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_can_use_lead_dossier(uuid) TO authenticated, service_role;

CREATE TABLE public.lead_ai_dossiers (
  lead_id uuid PRIMARY KEY REFERENCES public.lia_attendances(id) ON DELETE CASCADE,
  content text NOT NULL,
  model text NOT NULL,
  sources jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_at timestamptz NOT NULL DEFAULT now(),
  generated_by uuid
);
GRANT SELECT ON public.lead_ai_dossiers TO authenticated;
GRANT ALL ON public.lead_ai_dossiers TO service_role;
ALTER TABLE public.lead_ai_dossiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sales team reads lead dossiers"
  ON public.lead_ai_dossiers FOR SELECT TO authenticated
  USING (public.fn_can_use_lead_dossier(auth.uid()));