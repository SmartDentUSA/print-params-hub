
CREATE TABLE public.sentinela_group_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  instance_name text NOT NULL DEFAULT 'Danilo Henrique',
  group_id uuid REFERENCES public.wa_groups(id) ON DELETE SET NULL,
  group_jid text NOT NULL,
  group_name text,
  message_id text,
  sender_jid text,
  sender_phone text,
  sender_name text,
  lead_id uuid,
  message_text text,
  media_type text,
  media_url text,
  from_me boolean DEFAULT false,
  message_ts timestamptz,
  raw_payload jsonb,
  processed boolean NOT NULL DEFAULT false,
  processed_at timestamptz,
  ai_batch_id uuid,
  sentiment text,
  intent text,
  urgency text,
  topics text[],
  product_mentions text[],
  competitor_mentions text[],
  pain_points text[],
  buy_signals boolean NOT NULL DEFAULT false,
  relevance_score integer,
  CONSTRAINT sentinela_messages_unique UNIQUE (instance_name, message_id)
);
CREATE INDEX idx_sentinela_messages_group ON public.sentinela_group_messages(group_id);
CREATE INDEX idx_sentinela_messages_ts ON public.sentinela_group_messages(message_ts DESC);
CREATE INDEX idx_sentinela_messages_unprocessed ON public.sentinela_group_messages(created_at) WHERE NOT processed;
CREATE INDEX idx_sentinela_messages_buy_signals ON public.sentinela_group_messages(message_ts DESC) WHERE buy_signals = true;
CREATE INDEX idx_sentinela_messages_lead ON public.sentinela_group_messages(lead_id) WHERE lead_id IS NOT NULL;

GRANT SELECT ON public.sentinela_group_messages TO authenticated;
GRANT ALL ON public.sentinela_group_messages TO service_role;

ALTER TABLE public.sentinela_group_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read sentinela messages"
  ON public.sentinela_group_messages FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE TABLE public.sentinela_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  insight_type text NOT NULL,
  period_start timestamptz,
  period_end timestamptz,
  title text NOT NULL,
  summary text NOT NULL,
  detail text,
  category text,
  messages_analyzed integer DEFAULT 0,
  groups_analyzed integer DEFAULT 0,
  metrics jsonb,
  action_items jsonb,
  supporting_msgs uuid[],
  severity text NOT NULL DEFAULT 'info',
  reviewed boolean NOT NULL DEFAULT false,
  reviewed_at timestamptz,
  reviewed_by uuid,
  resolution_note text
);
CREATE INDEX idx_sentinela_insights_type ON public.sentinela_insights(insight_type, created_at DESC);
CREATE INDEX idx_sentinela_insights_unreviewed ON public.sentinela_insights(created_at DESC) WHERE NOT reviewed;

GRANT SELECT ON public.sentinela_insights TO authenticated;
GRANT INSERT, UPDATE ON public.sentinela_insights TO authenticated;
GRANT ALL ON public.sentinela_insights TO service_role;

ALTER TABLE public.sentinela_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read insights"
  ON public.sentinela_insights FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins update insights"
  ON public.sentinela_insights FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE TABLE public.sentinela_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  group_id uuid REFERENCES public.wa_groups(id) ON DELETE CASCADE UNIQUE,
  monitoring_active boolean NOT NULL DEFAULT true,
  priority text NOT NULL DEFAULT 'medium',
  focus_topics text[],
  notes text
);

GRANT SELECT ON public.sentinela_config TO authenticated;
GRANT ALL ON public.sentinela_config TO service_role;

ALTER TABLE public.sentinela_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read sentinela config"
  ON public.sentinela_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage sentinela config"
  ON public.sentinela_config FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER trg_sentinela_config_updated
  BEFORE UPDATE ON public.sentinela_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.sentinela_config (group_id, monitoring_active, priority)
SELECT g.id, true, 'high'
FROM public.wa_groups g
WHERE g.instance_name = 'Danilo Henrique'
  AND g.ativo = true
  AND (
    g.name ILIKE '%Odontologia Digital%'
    OR g.name ILIKE '%Exocad%'
    OR g.name ILIKE '%Scanner%'
    OR g.name ILIKE '%Smart Dent%'
    OR g.name ILIKE '%Classificados%'
    OR g.name ILIKE '%Dentista Econ%'
    OR g.name ILIKE '%Venda de Equipamentos%'
  )
ON CONFLICT (group_id) DO NOTHING;
