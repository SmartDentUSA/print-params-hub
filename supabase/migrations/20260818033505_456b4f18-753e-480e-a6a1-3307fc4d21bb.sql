CREATE OR REPLACE FUNCTION public.fn_client_access_invites()
 RETURNS TABLE(destino text, nome text, lead_id uuid, canal text, sent_at timestamp with time zone, status text, confirmed_at timestamp with time zone, last_seen_at timestamp with time zone, online boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH runs AS (
    SELECT r.destino, r.lead_id, r.canal, r.created_at AS sent_at, r.status,
           NULL::timestamptz AS confirmed_at, NULL::timestamptz AS last_seen_at, NULL::text AS nome
    FROM smartops_automation_runs r
    WHERE r.automation_nome ILIKE '%acesso%'
  ),
  invites AS (
    SELECT i.destino, i.lead_id, i.canal, i.sent_at, i.status, i.confirmed_at, i.last_seen_at, i.nome
    FROM client_access_invites i
  ),
  todos AS (
    SELECT * FROM runs UNION ALL SELECT * FROM invites
  ),
  keyed AS (
    SELECT t.*,
           COALESCE(t.lead_id::text, right(regexp_replace(COALESCE(t.destino,''), '\D', '', 'g'), 10)) AS ckey
    FROM todos t
  ),
  agg AS (
    SELECT k.ckey,
           max(k.sent_at) AS sent_at,
           max(k.confirmed_at) AS confirmed_at,
           max(k.last_seen_at) AS last_seen_at,
           (array_agg(k.lead_id ORDER BY k.sent_at DESC NULLS LAST))[1] AS lead_id,
           (array_agg(k.destino ORDER BY length(regexp_replace(COALESCE(k.destino,''),'\D','','g')) ASC, k.sent_at DESC))[1] AS destino,
           (array_agg(k.canal ORDER BY k.sent_at DESC NULLS LAST))[1] AS canal,
           (array_agg(k.nome ORDER BY k.sent_at DESC NULLS LAST))[1] AS nome_invite,
           bool_or(k.status = 'confirmado') AS tem_confirmado,
           (array_agg(k.status ORDER BY k.sent_at DESC NULLS LAST))[1] AS ultimo_status
    FROM keyed k
    GROUP BY k.ckey
  )
  SELECT a.destino,
         COALESCE(l.nome, a.nome_invite) AS nome,
         a.lead_id,
         a.canal,
         a.sent_at,
         CASE WHEN a.tem_confirmado THEN 'confirmado' ELSE a.ultimo_status END AS status,
         a.confirmed_at,
         a.last_seen_at,
         (a.last_seen_at IS NOT NULL AND a.last_seen_at > now() - interval '30 minutes') AS online
  FROM agg a
  LEFT JOIN lia_attendances l ON l.id = a.lead_id AND l.merged_into IS NULL
  ORDER BY a.sent_at DESC
$function$;