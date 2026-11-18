CREATE OR REPLACE FUNCTION public.fn_wa_official_campaign_recipients(p_session uuid)
RETURNS TABLE(
  lead_id uuid, nome text, telefone text, status text, provider_status text,
  sent_at timestamptz, delivered_at timestamptz, read_at timestamptz, error_message text,
  buttons text[], first_click_at timestamptz, sair_at timestamptz
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
WITH s AS (
  SELECT id, created_at FROM campaign_sessions WHERE id = p_session AND channel = 'whatsapp_oficial'
),
l AS (
  SELECT c.* FROM campaign_send_log c JOIN s ON c.campaign_id = s.id
),
clk AS (
  SELECT i.instance_name, i.created_at, btrim(i.raw_payload->'metadata'->>'buttonPayload') AS btn,
         i.lead_id AS ilead,
         regexp_replace(coalesce(i.phone_normalized, i.phone, ''), '\D', '', 'g') AS d,
         coalesce(i.raw_payload->'metadata'->'quotedMessage'->>'platformMessageId',
                  i.raw_payload->'metadata'->>'quotedMessageId') AS q
  FROM whatsapp_inbox i, s
  WHERE i.direction = 'inbound' AND i.instance_name LIKE 'zernio:%' AND i.created_at >= s.created_at
    AND coalesce(btrim(i.raw_payload->'metadata'->>'buttonPayload'), '') <> ''
),
m AS (
  SELECT coalesce(l1.lead_id, l2.lead_id) AS lead_id, clk.btn, clk.created_at
  FROM clk
  LEFT JOIN l l1 ON clk.q IS NOT NULL AND l1.wa_message_id = clk.q
  LEFT JOIN LATERAL (
    SELECT o.raw_payload->'message'->>'broadcastId' AS bid FROM whatsapp_inbox o
    WHERE l1.lead_id IS NULL AND clk.q IS NOT NULL AND o.instance_name = clk.instance_name AND o.wa_message_id = clk.q
    LIMIT 1
  ) o ON true
  LEFT JOIN LATERAL (
    SELECT x.lead_id FROM l x
    WHERE l1.lead_id IS NULL AND o.bid IS NOT NULL AND x.provider_message_id = o.bid
      AND (x.lead_id = clk.ilead OR (length(clk.d) >= 12 AND length(x.telefone) >= 12
           AND substr(x.telefone, 3, 2) || right(x.telefone, 8) = substr(clk.d, 3, 2) || right(clk.d, 8)))
    LIMIT 1
  ) l2 ON true
),
agg AS (
  SELECT m.lead_id, array_agg(DISTINCT m.btn ORDER BY m.btn) AS buttons, min(m.created_at) AS first_click_at
  FROM m WHERE m.lead_id IS NOT NULL GROUP BY m.lead_id
),
sr AS (
  SELECT l.lead_id, min(a.event_timestamp) AS sair_at
  FROM l
  JOIN lead_activity_log a ON a.lead_id = l.lead_id AND a.event_type = 'whatsapp_oficial_sair'
   AND l.sent_at IS NOT NULL AND a.event_timestamp >= l.sent_at
  WHERE NOT EXISTS (
    SELECT 1 FROM campaign_send_log x
    WHERE x.lead_id = l.lead_id AND x.provider = 'zernio_cloud_api' AND x.campaign_id <> l.campaign_id
      AND x.sent_at > l.sent_at AND x.sent_at <= a.event_timestamp
  )
  GROUP BY l.lead_id
)
SELECT l.lead_id, l.nome, l.telefone, l.status, l.provider_status, l.sent_at, l.delivered_at, l.opened_at,
       l.error_message, agg.buttons, agg.first_click_at, sr.sair_at
FROM l LEFT JOIN agg ON agg.lead_id = l.lead_id LEFT JOIN sr ON sr.lead_id = l.lead_id
$$;

CREATE OR REPLACE FUNCTION public.fn_wa_official_campaign_engagement(p_ids uuid[])
RETURNS TABLE(
  session_id uuid, leads integer, delivered integer, read_count integer, failed integer,
  clicked integer, buttons jsonb, sair integer, no_action integer
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
SELECT sid, x.*
FROM unnest(p_ids) AS sid,
LATERAL (
  WITH r AS (SELECT * FROM public.fn_wa_official_campaign_recipients(sid))
  SELECT count(*)::int,
         count(*) FILTER (WHERE r.delivered_at IS NOT NULL OR r.read_at IS NOT NULL OR r.provider_status IN ('delivered','read'))::int,
         count(*) FILTER (WHERE r.read_at IS NOT NULL OR r.provider_status = 'read')::int,
         count(*) FILTER (WHERE r.status = 'failed')::int,
         count(*) FILTER (WHERE r.buttons IS NOT NULL)::int,
         (SELECT coalesce(jsonb_object_agg(z.b, z.n), '{}'::jsonb)
            FROM (SELECT b, count(*)::int AS n FROM r r2, unnest(r2.buttons) AS b GROUP BY b) z),
         count(*) FILTER (WHERE r.sair_at IS NOT NULL)::int,
         count(*) FILTER (WHERE (r.delivered_at IS NOT NULL OR r.read_at IS NOT NULL OR r.provider_status IN ('delivered','read'))
                            AND r.buttons IS NULL AND r.sair_at IS NULL)::int
  FROM r
) x
$$;

REVOKE ALL ON FUNCTION public.fn_wa_official_campaign_recipients(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_wa_official_campaign_engagement(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_wa_official_campaign_recipients(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_wa_official_campaign_engagement(uuid[]) TO authenticated, service_role;