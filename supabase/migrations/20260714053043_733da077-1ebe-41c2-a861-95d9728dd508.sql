
-- ============================================
-- LTV Reactivation Rules
-- ============================================
CREATE TABLE public.ltv_reactivation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  trigger_days_list INTEGER[] NOT NULL DEFAULT ARRAY[30,60,120],
  source_pipeline_id TEXT,
  target_pipeline_id TEXT,
  target_stage_id TEXT,
  lost_pipeline_id TEXT,
  loss_reason_id TEXT,
  seller_strategy TEXT NOT NULL DEFAULT 'original' CHECK (seller_strategy IN ('original','round_robin','fixed')),
  fixed_seller_id UUID REFERENCES public.team_members(id) ON DELETE SET NULL,
  round_robin_seller_ids UUID[] DEFAULT ARRAY[]::UUID[],
  deal_title_template TEXT DEFAULT 'LTV {days}d — {person_name}',
  deal_origin_tag_template TEXT DEFAULT '#LTV-Ativo-{days}',
  product_suggestion_source TEXT DEFAULT 'last_deal' CHECK (product_suggestion_source IN ('last_deal','category','manual')),
  suggested_products JSONB DEFAULT '[]'::jsonb,
  product_category TEXT,
  notify_seller BOOLEAN NOT NULL DEFAULT false,
  whatsapp_template_id UUID,
  waleads_message TEXT,
  min_ltv NUMERIC DEFAULT 0,
  max_open_ltv_deals INTEGER DEFAULT 1,
  cooldown_days INTEGER DEFAULT 30,
  dry_run BOOLEAN NOT NULL DEFAULT false,
  priority INTEGER DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ltv_reactivation_rules TO authenticated;
GRANT ALL ON public.ltv_reactivation_rules TO service_role;
ALTER TABLE public.ltv_reactivation_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_full_access" ON public.ltv_reactivation_rules FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================
-- LTV Reactivation Runs (histórico + idempotência)
-- ============================================
CREATE TABLE public.ltv_reactivation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID NOT NULL REFERENCES public.ltv_reactivation_rules(id) ON DELETE CASCADE,
  source_deal_id TEXT NOT NULL,
  trigger_day INTEGER NOT NULL,
  person_id TEXT,
  company_id TEXT,
  lead_id UUID REFERENCES public.lia_attendances(id) ON DELETE SET NULL,
  new_deal_id TEXT,
  seller_id UUID REFERENCES public.team_members(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','created','skipped','lost','won','error')),
  skip_reason TEXT,
  error_message TEXT,
  dry_run BOOLEAN NOT NULL DEFAULT false,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (rule_id, source_deal_id, trigger_day)
);
CREATE INDEX idx_ltv_runs_status ON public.ltv_reactivation_runs(status);
CREATE INDEX idx_ltv_runs_triggered_at ON public.ltv_reactivation_runs(triggered_at DESC);
CREATE INDEX idx_ltv_runs_lead ON public.ltv_reactivation_runs(lead_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ltv_reactivation_runs TO authenticated;
GRANT ALL ON public.ltv_reactivation_runs TO service_role;
ALTER TABLE public.ltv_reactivation_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_full_access" ON public.ltv_reactivation_runs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================
-- Operational Flows (grafos editáveis)
-- ============================================
CREATE TABLE public.operational_flows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT false,
  current_version INTEGER NOT NULL DEFAULT 1,
  graph JSONB NOT NULL DEFAULT '{"nodes":[],"edges":[]}'::jsonb,
  rollout_mode TEXT NOT NULL DEFAULT 'hardcoded' CHECK (rollout_mode IN ('hardcoded','shadow','active')),
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.operational_flows TO authenticated;
GRANT ALL ON public.operational_flows TO service_role;
ALTER TABLE public.operational_flows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_full_access" ON public.operational_flows FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================
-- Operational Flow Versions (rollback)
-- ============================================
CREATE TABLE public.operational_flow_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id UUID NOT NULL REFERENCES public.operational_flows(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  graph JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','shadow','archived')),
  note TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (flow_id, version)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.operational_flow_versions TO authenticated;
GRANT ALL ON public.operational_flow_versions TO service_role;
ALTER TABLE public.operational_flow_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_full_access" ON public.operational_flow_versions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================
-- Operational Flow Shadow Log
-- ============================================
CREATE TABLE public.operational_flow_shadow_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id UUID NOT NULL REFERENCES public.operational_flows(id) ON DELETE CASCADE,
  version_a INTEGER NOT NULL,
  version_b INTEGER NOT NULL,
  input_payload JSONB,
  output_a JSONB,
  output_b JSONB,
  divergence BOOLEAN NOT NULL DEFAULT false,
  divergence_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_flow_shadow_flow ON public.operational_flow_shadow_log(flow_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.operational_flow_shadow_log TO authenticated;
GRANT ALL ON public.operational_flow_shadow_log TO service_role;
ALTER TABLE public.operational_flow_shadow_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_full_access" ON public.operational_flow_shadow_log FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================
-- Operational Settings (singleton)
-- ============================================
CREATE TABLE public.operational_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton BOOLEAN NOT NULL DEFAULT true UNIQUE,
  piperun_cs_pipeline_id TEXT,
  piperun_vendas_pipeline_id TEXT,
  piperun_ltv_pipeline_id TEXT,
  piperun_ltv_stage_id TEXT,
  piperun_ltv_lost_pipeline_id TEXT,
  piperun_ltv_loss_reason_id TEXT,
  default_trigger_days INTEGER[] NOT NULL DEFAULT ARRAY[30,60,120],
  default_seller_strategy TEXT NOT NULL DEFAULT 'original',
  default_cooldown_days INTEGER NOT NULL DEFAULT 30,
  ltv_cron_hour INTEGER NOT NULL DEFAULT 7,
  ltv_cron_minute INTEGER NOT NULL DEFAULT 0,
  rollout_mode TEXT NOT NULL DEFAULT 'shadow' CHECK (rollout_mode IN ('direct','shadow')),
  shadow_duration_days INTEGER NOT NULL DEFAULT 7,
  guard_golden_rule BOOLEAN NOT NULL DEFAULT true,
  guard_commercial_intent BOOLEAN NOT NULL DEFAULT true,
  guard_person_origin_frozen BOOLEAN NOT NULL DEFAULT true,
  guard_dedupe BOOLEAN NOT NULL DEFAULT true,
  commercial_intent_whitelist TEXT[] DEFAULT ARRAY[]::TEXT[],
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT operational_settings_singleton_check CHECK (singleton = true)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.operational_settings TO authenticated;
GRANT ALL ON public.operational_settings TO service_role;
ALTER TABLE public.operational_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_full_access" ON public.operational_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Seed singleton
INSERT INTO public.operational_settings (singleton) VALUES (true) ON CONFLICT DO NOTHING;

-- Seed operational_flows (grafo vazio; edge functions continuam com fallback hardcoded)
INSERT INTO public.operational_flows (flow_key, name, description, active, rollout_mode) VALUES
  ('ingest_lead', 'Ingestão de Lead', 'Detecção de source, merge policy, guards de segurança e roteamento inicial.', false, 'hardcoded'),
  ('assign', 'Atribuição / Distribuição', 'Golden Rule, round-robin sobre team_members, fallback distribuidor.', false, 'hardcoded'),
  ('cs_rule', 'Régua CS', 'Automações CS pós-venda por delay/produto.', false, 'hardcoded'),
  ('ltv', 'Reativação LTV', 'Abertura de deals no funil LTV em D+30/60/120 após ganho.', false, 'hardcoded'),
  ('form_ingest', 'Ingestão de Formulário SDR', 'Ingestão dedicada de formulários SmartOps.', false, 'hardcoded')
ON CONFLICT (flow_key) DO NOTHING;

-- Update triggers
CREATE OR REPLACE FUNCTION public.tg_touch_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER tg_ltv_rules_touch BEFORE UPDATE ON public.ltv_reactivation_rules FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
CREATE TRIGGER tg_ltv_runs_touch BEFORE UPDATE ON public.ltv_reactivation_runs FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
CREATE TRIGGER tg_flows_touch BEFORE UPDATE ON public.operational_flows FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
CREATE TRIGGER tg_settings_touch BEFORE UPDATE ON public.operational_settings FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
