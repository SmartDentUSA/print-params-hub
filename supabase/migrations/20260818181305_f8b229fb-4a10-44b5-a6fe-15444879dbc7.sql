CREATE TABLE IF NOT EXISTS public.client_online_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL UNIQUE,
  identity_key text NOT NULL,
  lead_id uuid,
  nome text,
  email text,
  phone text,
  page_path text,
  page_title text,
  device_type text,
  user_agent text,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cos_identity ON public.client_online_sessions (identity_key, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_cos_last_seen ON public.client_online_sessions (last_seen_at DESC);

GRANT ALL ON public.client_online_sessions TO service_role;
ALTER TABLE public.client_online_sessions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.fn_online_clients(p_window_minutes integer DEFAULT 5)
RETURNS TABLE(
  identity_key text,
  lead_id uuid,
  nome text,
  email text,
  phone text,
  connections integer,
  last_seen_at timestamptz,
  page_path text,
  devices text[]
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    s.identity_key,
    (array_agg(s.lead_id ORDER BY s.last_seen_at DESC) FILTER (WHERE s.lead_id IS NOT NULL))[1] AS lead_id,
    (array_agg(s.nome ORDER BY s.last_seen_at DESC) FILTER (WHERE s.nome IS NOT NULL))[1] AS nome,
    (array_agg(s.email ORDER BY s.last_seen_at DESC) FILTER (WHERE s.email IS NOT NULL))[1] AS email,
    (array_agg(s.phone ORDER BY s.last_seen_at DESC) FILTER (WHERE s.phone IS NOT NULL))[1] AS phone,
    COUNT(*)::int AS connections,
    MAX(s.last_seen_at) AS last_seen_at,
    (array_agg(s.page_path ORDER BY s.last_seen_at DESC) FILTER (WHERE s.page_path IS NOT NULL))[1] AS page_path,
    COALESCE(array_agg(DISTINCT s.device_type) FILTER (WHERE s.device_type IS NOT NULL), ARRAY[]::text[]) AS devices
  FROM public.client_online_sessions s
  WHERE s.last_seen_at > now() - make_interval(mins => GREATEST(COALESCE(p_window_minutes, 5), 1))
  GROUP BY s.identity_key
  ORDER BY MAX(s.last_seen_at) DESC
$$;

GRANT EXECUTE ON FUNCTION public.fn_online_clients(integer) TO anon, authenticated, service_role;