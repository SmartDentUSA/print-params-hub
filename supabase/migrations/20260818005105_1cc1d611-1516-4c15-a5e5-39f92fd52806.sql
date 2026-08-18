CREATE TABLE IF NOT EXISTS public.client_access_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid,
  nome text,
  destino text NOT NULL,
  canal text NOT NULL,
  token text,
  sent_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  first_login_at timestamptz,
  last_seen_at timestamptz,
  user_id uuid,
  status text NOT NULL DEFAULT 'enviado',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_access_invites_destino ON public.client_access_invites (destino);
CREATE INDEX IF NOT EXISTS idx_client_access_invites_lead ON public.client_access_invites (lead_id);

GRANT SELECT ON public.client_access_invites TO authenticated;
GRANT ALL ON public.client_access_invites TO service_role;

ALTER TABLE public.client_access_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view client access invites" ON public.client_access_invites;
CREATE POLICY "Admins can view client access invites"
ON public.client_access_invites FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.fn_client_access_invites()
RETURNS TABLE (
  destino text,
  nome text,
  lead_id uuid,
  canal text,
  sent_at timestamptz,
  status text,
  confirmed_at timestamptz,
  last_seen_at timestamptz,
  online boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH runs AS (
    SELECT r.destino,
           r.lead_id,
           r.canal,
           r.created_at AS sent_at,
           r.status
    FROM smartops_automation_runs r
    WHERE r.automation_nome ILIKE '%acesso%'
  ),
  invites AS (
    SELECT i.destino, i.lead_id, i.canal, i.sent_at, i.status
    FROM client_access_invites i
  ),
  todos AS (
    SELECT * FROM runs
    UNION ALL
    SELECT * FROM invites
  )
  SELECT t.destino,
         COALESCE(l.nome, ci.nome) AS nome,
         t.lead_id,
         t.canal,
         t.sent_at,
         t.status,
         ci.confirmed_at,
         ci.last_seen_at,
         (ci.last_seen_at IS NOT NULL AND ci.last_seen_at > now() - interval '5 minutes') AS online
  FROM todos t
  LEFT JOIN lia_attendances l ON l.id = t.lead_id AND l.merged_into IS NULL
  LEFT JOIN LATERAL (
    SELECT c.confirmed_at, c.last_seen_at, c.nome
    FROM client_access_invites c
    WHERE c.destino = t.destino OR (t.lead_id IS NOT NULL AND c.lead_id = t.lead_id)
    ORDER BY c.confirmed_at DESC NULLS LAST, c.sent_at DESC
    LIMIT 1
  ) ci ON TRUE
  ORDER BY t.sent_at DESC
$$;

GRANT EXECUTE ON FUNCTION public.fn_client_access_invites() TO authenticated;