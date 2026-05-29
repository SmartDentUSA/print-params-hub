CREATE OR REPLACE VIEW public.v_wa_group_summary AS
SELECT g.id AS group_id,
    g.group_jid,
    g.name AS group_name,
    g.description,
    g.member_count,
    g.is_admin,
    g.enabled,
    g.instance_name,
    g.active_campaign_id,
    g.synced_at,
    c.id AS campaign_id,
    c.name AS campaign_name,
    c.status AS campaign_status,
    c.campaign_type,
    c.current_node_index,
    c.next_send_at,
    c.started_at,
    COALESCE(jsonb_array_length(c.flow_json), 0) AS total_nodes,
    ( SELECT count(*) FROM wa_message_queue q
       WHERE q.campaign_id = c.id AND q.status = 'sent') AS msgs_sent,
    ( SELECT count(*) FROM wa_message_queue q
       WHERE q.campaign_id = c.id AND q.status = 'pending') AS msgs_pending,
    ( SELECT count(*) FROM wa_message_queue q
       WHERE q.campaign_id = c.id AND q.status IN ('failed','blocked_session')) AS msgs_failed,
    (EXISTS ( SELECT 1
        FROM wa_campaign_groups cg
        JOIN wa_campaigns cc ON cc.id = cg.campaign_id
       WHERE cg.group_id = g.id
         AND cc.group_id IS NULL
         AND cc.status = ANY (ARRAY['draft','active','paused']))) AS in_shared_campaign,
    g.session_health,
    g.consecutive_send_errors,
    g.last_send_error,
    g.last_send_error_at,
    EXISTS (
      SELECT 1 FROM team_members tm
       WHERE tm.evolution_instance_name = g.instance_name
         AND tm.evolution_group_key_broken_at IS NOT NULL
    ) AS group_key_auto_fallback
FROM wa_groups g
LEFT JOIN wa_campaigns c ON c.id = g.active_campaign_id;