
-- ============================================================
-- WA Group Scheduler — Reconciliação 004
-- ============================================================

-- 1) Renomeia colunas wa_groups PT-BR -> EN (idempotente)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='wa_groups' AND column_name='nome')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='wa_groups' AND column_name='name') THEN
    ALTER TABLE public.wa_groups RENAME COLUMN nome TO name;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='wa_groups' AND column_name='descricao')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='wa_groups' AND column_name='description') THEN
    ALTER TABLE public.wa_groups RENAME COLUMN descricao TO description;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='wa_groups' AND column_name='membros_count')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='wa_groups' AND column_name='member_count') THEN
    ALTER TABLE public.wa_groups RENAME COLUMN membros_count TO member_count;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='wa_groups' AND column_name='evolution_instance')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='wa_groups' AND column_name='instance_name') THEN
    ALTER TABLE public.wa_groups RENAME COLUMN evolution_instance TO instance_name;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='wa_groups' AND column_name='ultima_sync')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='wa_groups' AND column_name='synced_at') THEN
    ALTER TABLE public.wa_groups RENAME COLUMN ultima_sync TO synced_at;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='wa_groups' AND column_name='regua_ativa')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='wa_groups' AND column_name='_regua_ativa_legacy') THEN
    ALTER TABLE public.wa_groups RENAME COLUMN regua_ativa TO _regua_ativa_legacy;
  END IF;
END $$;

ALTER TABLE public.wa_groups
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS phone_number TEXT,
  ADD COLUMN IF NOT EXISTS picture_url TEXT,
  ADD COLUMN IF NOT EXISTS active_campaign_id UUID;

-- 2) wa_campaigns
CREATE TABLE IF NOT EXISTS public.wa_campaigns (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id            UUID NOT NULL REFERENCES public.wa_groups(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  flow_json           JSONB NOT NULL DEFAULT '[]'::jsonb,
  status              TEXT NOT NULL DEFAULT 'draft', -- draft|active|paused|finished|error
  delay_seconds       INT  NOT NULL DEFAULT 15,
  daily_limit         INT  NOT NULL DEFAULT 20,
  current_node_index  INT  NOT NULL DEFAULT 0,
  next_send_at        TIMESTAMPTZ,
  started_at          TIMESTAMPTZ,
  finished_at         TIMESTAMPTZ,
  created_by          UUID,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wa_campaigns TO authenticated;
GRANT ALL ON public.wa_campaigns TO service_role;
ALTER TABLE public.wa_campaigns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS wa_campaigns_auth_all ON public.wa_campaigns;
CREATE POLICY wa_campaigns_auth_all ON public.wa_campaigns FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- FK wa_groups.active_campaign_id -> wa_campaigns(id) (idempotente)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_wa_groups_active_campaign') THEN
    ALTER TABLE public.wa_groups
      ADD CONSTRAINT fk_wa_groups_active_campaign
      FOREIGN KEY (active_campaign_id) REFERENCES public.wa_campaigns(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 3) wa_message_queue
CREATE TABLE IF NOT EXISTS public.wa_message_queue (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id     UUID NOT NULL REFERENCES public.wa_campaigns(id) ON DELETE CASCADE,
  group_jid       TEXT NOT NULL,
  node_index      INT  NOT NULL,
  node_type       TEXT NOT NULL,
  content_json    JSONB NOT NULL DEFAULT '{}'::jsonb,
  scheduled_at    TIMESTAMPTZ NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending', -- pending|sending|sent|failed|skipped
  sent_at         TIMESTAMPTZ,
  evo_message_id  TEXT,
  retry_count     INT NOT NULL DEFAULT 0,
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wa_queue_pending ON public.wa_message_queue(status, scheduled_at) WHERE status='pending';
CREATE INDEX IF NOT EXISTS idx_wa_queue_campaign ON public.wa_message_queue(campaign_id);
CREATE INDEX IF NOT EXISTS idx_wa_queue_group_node_sent ON public.wa_message_queue(group_jid, node_index, sent_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wa_message_queue TO authenticated;
GRANT ALL ON public.wa_message_queue TO service_role;
ALTER TABLE public.wa_message_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS wa_queue_auth_all ON public.wa_message_queue;
CREATE POLICY wa_queue_auth_all ON public.wa_message_queue FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4) wa_send_log
CREATE TABLE IF NOT EXISTS public.wa_send_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id        UUID,
  campaign_id     UUID,
  group_jid       TEXT,
  instance_name   TEXT,
  node_type       TEXT,
  success         BOOLEAN NOT NULL,
  http_status     INT,
  evo_message_id  TEXT,
  error_message   TEXT,
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wa_send_log_campaign ON public.wa_send_log(campaign_id);
GRANT SELECT, INSERT ON public.wa_send_log TO authenticated;
GRANT ALL ON public.wa_send_log TO service_role;
ALTER TABLE public.wa_send_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS wa_send_log_auth_read ON public.wa_send_log;
CREATE POLICY wa_send_log_auth_read ON public.wa_send_log FOR SELECT TO authenticated USING (true);

-- 5) wa_verify_queue
CREATE TABLE IF NOT EXISTS public.wa_verify_queue (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id        UUID NOT NULL,
  phone          TEXT,
  status         TEXT NOT NULL DEFAULT 'pending', -- pending|processing|done|failed|no_phone
  error_message  TEXT,
  processed_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wa_verify_pending ON public.wa_verify_queue(status, created_at) WHERE status='pending';
GRANT SELECT, INSERT, UPDATE ON public.wa_verify_queue TO authenticated;
GRANT ALL ON public.wa_verify_queue TO service_role;
ALTER TABLE public.wa_verify_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS wa_verify_auth_read ON public.wa_verify_queue;
CREATE POLICY wa_verify_auth_read ON public.wa_verify_queue FOR SELECT TO authenticated USING (true);

-- 6) lia_attendances: wa_phone + wa_exists + wa_verified_at
ALTER TABLE public.lia_attendances
  ADD COLUMN IF NOT EXISTS wa_phone        TEXT,
  ADD COLUMN IF NOT EXISTS wa_exists       BOOLEAN,
  ADD COLUMN IF NOT EXISTS wa_verified_at  TIMESTAMPTZ;

-- Trigger: enfileira lead para verificação quando telefone aparece
CREATE OR REPLACE FUNCTION public.fn_queue_wa_verify()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.merged_into IS NULL
     AND NEW.telefone_normalized IS NOT NULL
     AND NEW.wa_verified_at IS NULL
     AND (TG_OP = 'INSERT' OR OLD.telefone_normalized IS DISTINCT FROM NEW.telefone_normalized) THEN
    INSERT INTO public.wa_verify_queue (lead_id, phone)
    VALUES (NEW.id, NEW.telefone_normalized)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_queue_wa_verify ON public.lia_attendances;
CREATE TRIGGER trg_queue_wa_verify
  AFTER INSERT OR UPDATE OF telefone_normalized ON public.lia_attendances
  FOR EACH ROW EXECUTE FUNCTION public.fn_queue_wa_verify();

-- 7) fn_check_group_send_cooldown: bloqueia mesmo nó <2h
CREATE OR REPLACE FUNCTION public.fn_check_group_send_cooldown(
  p_group_jid   TEXT,
  p_node_index  INT,
  p_campaign_id UUID
) RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.wa_message_queue
    WHERE group_jid = p_group_jid
      AND node_index = p_node_index
      AND campaign_id = p_campaign_id
      AND status = 'sent'
      AND sent_at > (now() - interval '2 hours')
  );
$$;
GRANT EXECUTE ON FUNCTION public.fn_check_group_send_cooldown(TEXT, INT, UUID) TO service_role, authenticated;

-- 8) v_wa_group_summary
DROP VIEW IF EXISTS public.v_wa_group_summary;
CREATE VIEW public.v_wa_group_summary AS
SELECT
  g.id                  AS group_id,
  g.group_jid,
  g.name                AS group_name,
  g.description,
  g.member_count,
  g.is_admin,
  g.instance_name,
  g.active_campaign_id,
  g.synced_at,
  c.id                  AS campaign_id,
  c.name                AS campaign_name,
  c.status              AS campaign_status,
  c.current_node_index,
  c.next_send_at,
  c.started_at,
  COALESCE(jsonb_array_length(c.flow_json), 0) AS total_nodes,
  (SELECT count(*) FROM public.wa_message_queue q WHERE q.campaign_id = c.id AND q.status='sent')    AS msgs_sent,
  (SELECT count(*) FROM public.wa_message_queue q WHERE q.campaign_id = c.id AND q.status='pending') AS msgs_pending,
  (SELECT count(*) FROM public.wa_message_queue q WHERE q.campaign_id = c.id AND q.status='failed')  AS msgs_failed
FROM public.wa_groups g
LEFT JOIN public.wa_campaigns c ON c.id = g.active_campaign_id;

GRANT SELECT ON public.v_wa_group_summary TO authenticated, service_role;

-- 9) updated_at triggers
CREATE OR REPLACE FUNCTION public.fn_wa_campaigns_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS trg_wa_campaigns_updated_at ON public.wa_campaigns;
CREATE TRIGGER trg_wa_campaigns_updated_at
  BEFORE UPDATE ON public.wa_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.fn_wa_campaigns_set_updated_at();
