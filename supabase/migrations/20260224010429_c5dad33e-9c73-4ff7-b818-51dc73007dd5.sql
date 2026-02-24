
-- =============================================
-- SMART OPS: 4 tabelas + RLS + indices + trigger
-- =============================================

-- 1. lia_attendances (hub central de leads)
CREATE TABLE public.lia_attendances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Source / Meta
  source TEXT NOT NULL DEFAULT 'unknown',
  form_name TEXT,
  raw_payload JSONB DEFAULT '{}'::jsonb,
  data_primeiro_contato TIMESTAMPTZ DEFAULT NOW(),

  -- Dados pessoais
  nome TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  telefone_raw TEXT,
  telefone_normalized TEXT,

  -- Formulario
  area_atuacao TEXT,
  especialidade TEXT,
  como_digitaliza TEXT,
  tem_impressora TEXT,
  impressora_modelo TEXT,
  resina_interesse TEXT,
  produto_interesse TEXT,

  -- Campanha / UTM
  origem_campanha TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_term TEXT,
  ip_origem TEXT,
  pais_origem TEXT DEFAULT 'Brazil',

  -- CRM
  lead_status TEXT NOT NULL DEFAULT 'novo',
  score INTEGER DEFAULT 0,
  piperun_id TEXT UNIQUE,
  funil_entrada_crm TEXT,
  proprietario_lead_crm TEXT,
  status_atual_lead_crm TEXT,

  -- IA / LIA
  rota_inicial_lia TEXT,
  resumo_historico_ia TEXT,
  reuniao_agendada BOOLEAN DEFAULT FALSE,

  -- Recorrencia (8 ativos)
  ativo_scan BOOLEAN DEFAULT FALSE,
  data_ultima_compra_scan TIMESTAMPTZ,
  ativo_notebook BOOLEAN DEFAULT FALSE,
  data_ultima_compra_notebook TIMESTAMPTZ,
  ativo_cad BOOLEAN DEFAULT FALSE,
  data_ultima_compra_cad TIMESTAMPTZ,
  ativo_cad_ia BOOLEAN DEFAULT FALSE,
  data_ultima_compra_cad_ia TIMESTAMPTZ,
  ativo_smart_slice BOOLEAN DEFAULT FALSE,
  data_ultima_compra_smart_slice TIMESTAMPTZ,
  ativo_print BOOLEAN DEFAULT FALSE,
  data_ultima_compra_print TIMESTAMPTZ,
  ativo_cura BOOLEAN DEFAULT FALSE,
  data_ultima_compra_cura TIMESTAMPTZ,
  ativo_insumos BOOLEAN DEFAULT FALSE,
  data_ultima_compra_insumos TIMESTAMPTZ,

  -- CS
  id_cliente_smart TEXT,
  data_contrato TIMESTAMPTZ,
  cs_treinamento TEXT DEFAULT 'pendente'
);

-- Indices lia_attendances
CREATE INDEX idx_lia_attendances_email ON public.lia_attendances (email);
CREATE INDEX idx_lia_attendances_piperun_id ON public.lia_attendances (piperun_id);
CREATE INDEX idx_lia_attendances_lead_status ON public.lia_attendances (lead_status);
CREATE INDEX idx_lia_attendances_source ON public.lia_attendances (source);

-- Trigger updated_at
CREATE TRIGGER update_lia_attendances_updated_at
  BEFORE UPDATE ON public.lia_attendances
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.lia_attendances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_only" ON public.lia_attendances FOR ALL USING (public.is_admin(auth.uid()));

-- 2. team_members
CREATE TABLE public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  role TEXT NOT NULL CHECK (role IN ('vendedor', 'cs', 'suporte')),
  nome_completo TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  whatsapp_number TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX idx_team_members_role ON public.team_members (role);
CREATE INDEX idx_team_members_ativo ON public.team_members (ativo);

CREATE TRIGGER update_team_members_updated_at
  BEFORE UPDATE ON public.team_members
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_only" ON public.team_members FOR ALL USING (public.is_admin(auth.uid()));

-- 3. message_logs
CREATE TABLE public.message_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  lead_id UUID REFERENCES public.lia_attendances(id) ON DELETE SET NULL,
  team_member_id UUID REFERENCES public.team_members(id) ON DELETE SET NULL,
  whatsapp_number TEXT,
  data_envio TIMESTAMPTZ DEFAULT NOW(),
  tipo TEXT,
  mensagem_preview TEXT,
  status TEXT NOT NULL DEFAULT 'pendente',
  error_details TEXT
);

CREATE INDEX idx_message_logs_lead_id ON public.message_logs (lead_id);
CREATE INDEX idx_message_logs_data_envio ON public.message_logs (data_envio);

ALTER TABLE public.message_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_only" ON public.message_logs FOR ALL USING (public.is_admin(auth.uid()));

-- 4. cs_automation_rules
CREATE TABLE public.cs_automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  produto_interesse TEXT,
  trigger_event TEXT,
  delay_days INTEGER,
  tipo TEXT,
  template_manychat TEXT,
  ativo BOOLEAN NOT NULL DEFAULT TRUE
);

ALTER TABLE public.cs_automation_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_only" ON public.cs_automation_rules FOR ALL USING (public.is_admin(auth.uid()));
