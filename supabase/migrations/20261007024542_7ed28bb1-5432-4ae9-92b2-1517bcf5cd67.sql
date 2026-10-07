CREATE OR REPLACE FUNCTION public.is_support_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin'::app_role, 'support_agent'::app_role))
$$;
REVOKE EXECUTE ON FUNCTION public.is_support_staff(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_support_staff(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.support_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- Categorias (com hierarquia e etapa do fluxo digital 1..7)
CREATE TABLE public.support_ticket_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid REFERENCES public.support_ticket_categories(id) ON DELETE CASCADE,
  name text NOT NULL,
  workflow_stage smallint,
  product_category text,
  product_subcategory text,
  description text,
  color text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_ticket_categories TO authenticated;
GRANT ALL ON public.support_ticket_categories TO service_role;
ALTER TABLE public.support_ticket_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "support_staff_manage_categories" ON public.support_ticket_categories FOR ALL TO authenticated
  USING (public.is_support_staff(auth.uid())) WITH CHECK (public.is_support_staff(auth.uid()));
CREATE INDEX idx_support_categories_parent ON public.support_ticket_categories(parent_id);
CREATE TRIGGER trg_support_categories_updated BEFORE UPDATE ON public.support_ticket_categories
  FOR EACH ROW EXECUTE FUNCTION public.support_touch_updated_at();

-- Tipos de chamado
CREATE TABLE public.support_ticket_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  category_id uuid REFERENCES public.support_ticket_categories(id) ON DELETE SET NULL,
  default_priority text NOT NULL DEFAULT 'normal',
  sla_first_response_minutes integer,
  sla_resolution_hours integer,
  requires_serial boolean NOT NULL DEFAULT false,
  ai_guidance text,
  color text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_ticket_types TO authenticated;
GRANT ALL ON public.support_ticket_types TO service_role;
ALTER TABLE public.support_ticket_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "support_staff_manage_types" ON public.support_ticket_types FOR ALL TO authenticated
  USING (public.is_support_staff(auth.uid())) WITH CHECK (public.is_support_staff(auth.uid()));
CREATE TRIGGER trg_support_types_updated BEFORE UPDATE ON public.support_ticket_types
  FOR EACH ROW EXECUTE FUNCTION public.support_touch_updated_at();

-- Checklists de diagnóstico (perguntas para atendente e IA)
CREATE TABLE public.support_diagnostic_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_type_id uuid REFERENCES public.support_ticket_types(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.support_ticket_categories(id) ON DELETE CASCADE,
  question text NOT NULL,
  answer_type text NOT NULL DEFAULT 'text',
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_required boolean NOT NULL DEFAULT false,
  use_in_ai boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_diagnostic_checklists TO authenticated;
GRANT ALL ON public.support_diagnostic_checklists TO service_role;
ALTER TABLE public.support_diagnostic_checklists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "support_staff_manage_checklists" ON public.support_diagnostic_checklists FOR ALL TO authenticated
  USING (public.is_support_staff(auth.uid())) WITH CHECK (public.is_support_staff(auth.uid()));
CREATE INDEX idx_support_checklists_type ON public.support_diagnostic_checklists(ticket_type_id);
CREATE TRIGGER trg_support_checklists_updated BEFORE UPDATE ON public.support_diagnostic_checklists
  FOR EACH ROW EXECUTE FUNCTION public.support_touch_updated_at();

-- Respostas rápidas
CREATE TABLE public.support_quick_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shortcut text,
  title text NOT NULL,
  body text NOT NULL,
  category text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_quick_replies TO authenticated;
GRANT ALL ON public.support_quick_replies TO service_role;
ALTER TABLE public.support_quick_replies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "support_staff_manage_quick_replies" ON public.support_quick_replies FOR ALL TO authenticated
  USING (public.is_support_staff(auth.uid())) WITH CHECK (public.is_support_staff(auth.uid()));
CREATE TRIGGER trg_support_quick_replies_updated BEFORE UPDATE ON public.support_quick_replies
  FOR EACH ROW EXECUTE FUNCTION public.support_touch_updated_at();

-- Extensão de technical_tickets
ALTER TABLE public.technical_tickets
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.support_ticket_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS subcategory_id uuid REFERENCES public.support_ticket_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ticket_type_id uuid REFERENCES public.support_ticket_types(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS workflow_stage smallint,
  ADD COLUMN IF NOT EXISTS kanban_status text NOT NULL DEFAULT 'triagem',
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS assigned_user_id uuid,
  ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'whatsapp',
  ADD COLUMN IF NOT EXISTS serial_number text,
  ADD COLUMN IF NOT EXISTS queued_at timestamptz,
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz,
  ADD COLUMN IF NOT EXISTS first_response_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_inbound_at timestamptz,
  ADD COLUMN IF NOT EXISTS closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reopened_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS first_contact_resolution boolean,
  ADD COLUMN IF NOT EXISTS ai_paused boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS diagnostic_answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS csat_score smallint,
  ADD COLUMN IF NOT EXISTS nps_score smallint,
  ADD COLUMN IF NOT EXISTS ces_score smallint,
  ADD COLUMN IF NOT EXISTS survey_feedback text,
  ADD COLUMN IF NOT EXISTS survey_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS survey_answered_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.support_validate_ticket()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.kanban_status NOT IN ('triagem','fila','em_atendimento','aguardando_cliente','aguardando_terceiros','resolvido','encerrado') THEN
    RAISE EXCEPTION 'kanban_status inválido: %', NEW.kanban_status; END IF;
  IF NEW.priority NOT IN ('baixa','normal','alta','urgente') THEN
    RAISE EXCEPTION 'priority inválida: %', NEW.priority; END IF;
  IF NEW.workflow_stage IS NOT NULL AND (NEW.workflow_stage < 1 OR NEW.workflow_stage > 7) THEN
    RAISE EXCEPTION 'workflow_stage deve estar entre 1 e 7'; END IF;
  IF NEW.csat_score IS NOT NULL AND (NEW.csat_score < 1 OR NEW.csat_score > 5) THEN RAISE EXCEPTION 'csat 1-5'; END IF;
  IF NEW.nps_score IS NOT NULL AND (NEW.nps_score < 0 OR NEW.nps_score > 10) THEN RAISE EXCEPTION 'nps 0-10'; END IF;
  IF NEW.ces_score IS NOT NULL AND (NEW.ces_score < 1 OR NEW.ces_score > 7) THEN RAISE EXCEPTION 'ces 1-7'; END IF;
  IF TG_OP = 'UPDATE' THEN
    NEW.updated_at = now();
    IF NEW.assigned_user_id IS NOT NULL AND OLD.assigned_user_id IS DISTINCT FROM NEW.assigned_user_id AND NEW.assigned_at IS NULL THEN
      NEW.assigned_at = now(); END IF;
    IF NEW.kanban_status IN ('resolvido','encerrado') AND OLD.kanban_status NOT IN ('resolvido','encerrado') THEN
      NEW.resolved_at = COALESCE(NEW.resolved_at, now()); END IF;
    IF NEW.kanban_status = 'encerrado' AND NEW.closed_at IS NULL THEN NEW.closed_at = now(); END IF;
    IF OLD.kanban_status IN ('resolvido','encerrado') AND NEW.kanban_status NOT IN ('resolvido','encerrado') THEN
      NEW.reopened_count = OLD.reopened_count + 1; NEW.first_contact_resolution = false; NEW.closed_at = NULL; END IF;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_support_validate_ticket BEFORE INSERT OR UPDATE ON public.technical_tickets
  FOR EACH ROW EXECUTE FUNCTION public.support_validate_ticket();

CREATE INDEX IF NOT EXISTS idx_technical_tickets_kanban ON public.technical_tickets(kanban_status);
CREATE INDEX IF NOT EXISTS idx_technical_tickets_assigned ON public.technical_tickets(assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_technical_tickets_type ON public.technical_tickets(ticket_type_id);

-- Acesso da equipe de suporte aos chamados (soma às políticas existentes)
CREATE POLICY "support_staff_all_tickets" ON public.technical_tickets FOR ALL TO authenticated
  USING (public.is_support_staff(auth.uid())) WITH CHECK (public.is_support_staff(auth.uid()));
CREATE POLICY "support_staff_all_ticket_messages" ON public.technical_ticket_messages FOR ALL TO authenticated
  USING (public.is_support_staff(auth.uid())) WITH CHECK (public.is_support_staff(auth.uid()));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.technical_tickets, public.technical_ticket_messages TO authenticated;
GRANT ALL ON public.technical_tickets, public.technical_ticket_messages TO service_role;