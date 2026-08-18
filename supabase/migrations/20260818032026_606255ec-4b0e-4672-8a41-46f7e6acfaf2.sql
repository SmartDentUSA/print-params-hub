CREATE OR REPLACE FUNCTION public.fn_client_access_invites()
 RETURNS TABLE(destino text, nome text, lead_id uuid, canal text, sent_at timestamp with time zone, status text, confirmed_at timestamp with time zone, last_seen_at timestamp with time zone, online boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH runs AS (
    SELECT r.destino, r.lead_id, r.canal, r.created_at AS sent_at, r.status
    FROM smartops_automation_runs r
    WHERE r.automation_nome ILIKE '%acesso%'
  ),
  invites AS (
    SELECT i.destino, i.lead_id, i.canal, i.sent_at, i.status
    FROM client_access_invites i
  ),
  todos AS (
    SELECT * FROM runs UNION ALL SELECT * FROM invites
  )
  SELECT t.destino,
         COALESCE(l.nome, ci.nome) AS nome,
         t.lead_id,
         t.canal,
         t.sent_at,
         t.status,
         ci.confirmed_at,
         ci.last_seen_at,
         (ci.last_seen_at IS NOT NULL AND ci.last_seen_at > now() - interval '30 minutes') AS online
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
$function$;