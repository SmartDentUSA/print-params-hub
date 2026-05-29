-- WA Groups v2 — multi-instance, multi-group campaigns, blast

-- 1) wa_groups: enabled column + index
ALTER TABLE public.wa_groups
  ADD COLUMN IF NOT EXISTS enabled boolean NOT NULL DEFAULT true;

-- Backfill: non-admin groups start disabled (can be toggled on for blast-only later)
UPDATE public.wa_groups SET enabled = is_admin WHERE enabled IS DISTINCT FROM is_admin;

CREATE INDEX IF NOT EXISTS idx_wa_groups_instance_enabled
  ON public.wa_groups (instance_name, enabled, is_admin);

-- 2) Junction table wa_campaign_groups (1 campaign -> N groups)
CREATE TABLE IF NOT EXISTS public.wa_campaign_groups (
  campaign_id uuid NOT NULL REFERENCES public.wa_campaigns(id) ON DELETE CASCADE,
  group_id    uuid NOT NULL REFERENCES public.wa_groups(id)    ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (campaign_id, group_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wa_campaign_groups TO authenticated;
GRANT ALL ON public.wa_campaign_groups TO service_role;

ALTER TABLE public.wa_campaign_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wa_campaign_groups_authenticated_all"
  ON public.wa_campaign_groups
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_wa_campaign_groups_group ON public.wa_campaign_groups (group_id);

-- 3) Allow wa_campaigns.group_id to be null (multi-group campaigns)
ALTER TABLE public.wa_campaigns ALTER COLUMN group_id DROP NOT NULL;

-- Optional: campaign_type to distinguish blast vs flow
ALTER TABLE public.wa_campaigns
  ADD COLUMN IF NOT EXISTS campaign_type text NOT NULL DEFAULT 'flow';

-- 4) Recreate v_wa_group_summary with enabled + in_shared_campaign
DROP VIEW IF EXISTS public.v_wa_group_summary CASCADE;
CREATE VIEW public.v_wa_group_summary AS
SELECT
  g.id              AS group_id,
  g.group_jid,
  g.name            AS group_name,
  g.description,
  g.member_count,
  g.is_admin,
  g.enabled,
  g.instance_name,
  g.active_campaign_id,
  g.synced_at,
  c.id              AS campaign_id,
  c.name            AS campaign_name,
  c.status          AS campaign_status,
  c.campaign_type,
  c.current_node_index,
  c.next_send_at,
  c.started_at,
  COALESCE(jsonb_array_length(c.flow_json), 0) AS total_nodes,
  ( SELECT count(*) FROM public.wa_message_queue q
      WHERE q.campaign_id = c.id AND q.status = 'sent' )    AS msgs_sent,
  ( SELECT count(*) FROM public.wa_message_queue q
      WHERE q.campaign_id = c.id AND q.status = 'pending' ) AS msgs_pending,
  ( SELECT count(*) FROM public.wa_message_queue q
      WHERE q.campaign_id = c.id AND q.status = 'failed' )  AS msgs_failed,
  EXISTS (
    SELECT 1 FROM public.wa_campaign_groups cg
    JOIN public.wa_campaigns cc ON cc.id = cg.campaign_id
    WHERE cg.group_id = g.id AND cc.group_id IS NULL
      AND cc.status IN ('draft','active','paused')
  ) AS in_shared_campaign
FROM public.wa_groups g
LEFT JOIN public.wa_campaigns c ON c.id = g.active_campaign_id;

GRANT SELECT ON public.v_wa_group_summary TO authenticated, service_role;

-- 5) v_wa_combined_campaigns: campaigns with group_id IS NULL (shared/blast)
CREATE OR REPLACE VIEW public.v_wa_combined_campaigns AS
SELECT
  c.id                AS campaign_id,
  c.name              AS campaign_name,
  c.status            AS campaign_status,
  c.campaign_type,
  c.current_node_index,
  c.next_send_at,
  c.started_at,
  COALESCE(jsonb_array_length(c.flow_json), 0) AS total_nodes,
  COUNT(cg.group_id)                           AS group_count,
  COALESCE(SUM(g.member_count), 0)::int        AS total_members,
  COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'group_id',      g.id,
        'group_jid',     g.group_jid,
        'group_name',    g.name,
        'member_count',  g.member_count,
        'is_admin',      g.is_admin,
        'enabled',       g.enabled,
        'instance_name', g.instance_name
      ) ORDER BY g.name
    ) FILTER (WHERE g.id IS NOT NULL),
    '[]'::jsonb
  ) AS groups,
  ( SELECT count(*) FROM public.wa_message_queue q
      WHERE q.campaign_id = c.id AND q.status = 'sent' )    AS msgs_sent,
  ( SELECT count(*) FROM public.wa_message_queue q
      WHERE q.campaign_id = c.id AND q.status = 'pending' ) AS msgs_pending,
  ( SELECT count(*) FROM public.wa_message_queue q
      WHERE q.campaign_id = c.id AND q.status = 'failed' )  AS msgs_failed
FROM public.wa_campaigns c
LEFT JOIN public.wa_campaign_groups cg ON cg.campaign_id = c.id
LEFT JOIN public.wa_groups g           ON g.id = cg.group_id
WHERE c.group_id IS NULL
GROUP BY c.id;

GRANT SELECT ON public.v_wa_combined_campaigns TO authenticated, service_role;

-- 6) RPC fn_detach_group_from_campaign
CREATE OR REPLACE FUNCTION public.fn_detach_group_from_campaign(
  p_campaign_id uuid,
  p_group_id    uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group_jid text;
  v_cancelled int;
BEGIN
  SELECT group_jid INTO v_group_jid FROM public.wa_groups WHERE id = p_group_id;

  DELETE FROM public.wa_campaign_groups
    WHERE campaign_id = p_campaign_id AND group_id = p_group_id;

  UPDATE public.wa_groups
    SET active_campaign_id = NULL
    WHERE id = p_group_id AND active_campaign_id = p_campaign_id;

  WITH cancelled AS (
    UPDATE public.wa_message_queue
       SET status = 'skipped',
           error_message = 'Grupo removido da campanha compartilhada'
     WHERE campaign_id = p_campaign_id
       AND group_jid   = v_group_jid
       AND status      = 'pending'
     RETURNING 1
  )
  SELECT count(*) INTO v_cancelled FROM cancelled;

  RETURN jsonb_build_object(
    'ok', true,
    'campaign_id', p_campaign_id,
    'group_id',    p_group_id,
    'cancelled',   v_cancelled
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_detach_group_from_campaign(uuid, uuid) TO authenticated, service_role;