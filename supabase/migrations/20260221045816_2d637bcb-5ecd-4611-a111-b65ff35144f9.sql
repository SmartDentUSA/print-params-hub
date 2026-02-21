
-- 1. Criar tabela leads
CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  specialty text,
  equipment_status text,
  workflow_interest text,
  pain_point text,
  spin_completed boolean DEFAULT false,
  source text DEFAULT 'dra-lia',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX leads_email_idx ON public.leads(email);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage leads" ON public.leads
  FOR ALL USING (is_admin(auth.uid()));

-- 2. Adicionar lead_id em agent_interactions
ALTER TABLE public.agent_interactions
  ADD COLUMN lead_id uuid REFERENCES public.leads(id);

-- 3. Adicionar lead_id em agent_sessions
ALTER TABLE public.agent_sessions
  ADD COLUMN lead_id uuid REFERENCES public.leads(id);

-- 4. Trigger para updated_at na tabela leads
CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
