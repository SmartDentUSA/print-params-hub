CREATE TABLE public.kol_contract_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text NOT NULL UNIQUE,
  body_md text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kol_contract_templates TO authenticated;
GRANT ALL ON public.kol_contract_templates TO service_role;
ALTER TABLE public.kol_contract_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage kol contract templates" ON public.kol_contract_templates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.kol_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'rascunho',
  template_version text NOT NULL,
  person_type text,
  legal_name text,
  document text,
  pix_key text,
  pdf_url text,
  body_rendered text,
  pending_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  signed_at timestamptz,
  signed_ip text,
  signed_user_agent text,
  accepted_text_hash text,
  accepted_phone_last10 text,
  acceptance_method text NOT NULL DEFAULT 'aceite_eletronico',
  image_scope jsonb,
  image_term_signed_at timestamptz,
  adjust_notes text,
  wa_instance_name text,
  wa_group_members jsonb NOT NULL DEFAULT '[]'::jsonb,
  wa_group_id text,
  wa_group_error text,
  sent_at timestamptz,
  revoked_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX kol_contracts_lead_idx ON public.kol_contracts(lead_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kol_contracts TO authenticated;
GRANT ALL ON public.kol_contracts TO service_role;
ALTER TABLE public.kol_contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage kol contracts" ON public.kol_contracts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.kol_commission_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kol_commission_templates TO authenticated;
GRANT ALL ON public.kol_commission_templates TO service_role;
ALTER TABLE public.kol_commission_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage kol commission templates" ON public.kol_commission_templates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.kol_commission_template_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.kol_commission_templates(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'categoria',
  category text,
  subcategory text,
  product_id text,
  percent numeric NOT NULL DEFAULT 0,
  active_from date,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kol_commission_template_items TO authenticated;
GRANT ALL ON public.kol_commission_template_items TO service_role;
ALTER TABLE public.kol_commission_template_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage kol commission items" ON public.kol_commission_template_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.kol_equipment_loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL,
  contract_id uuid REFERENCES public.kol_contracts(id) ON DELETE SET NULL,
  product_id text,
  product_name text,
  serial_number text,
  released_at date,
  returned_at date,
  value_brl numeric,
  status text NOT NULL DEFAULT 'emprestado',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX kol_equipment_loans_lead_idx ON public.kol_equipment_loans(lead_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kol_equipment_loans TO authenticated;
GRANT ALL ON public.kol_equipment_loans TO service_role;
ALTER TABLE public.kol_equipment_loans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage kol equipment" ON public.kol_equipment_loans FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

ALTER TABLE public.kol_access_sessions
  ADD COLUMN IF NOT EXISTS phone_last10 text,
  ADD COLUMN IF NOT EXISTS ip_hash text,
  ADD COLUMN IF NOT EXISTS user_agent text;

CREATE OR REPLACE FUNCTION public.fn_kol_validate_status()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_TABLE_NAME = 'kol_contracts' THEN
    IF NEW.status NOT IN ('rascunho','enviado','ajuste_solicitado','assinado','revogado') THEN
      RAISE EXCEPTION 'status de contrato inválido: %', NEW.status; END IF;
    IF NEW.person_type IS NOT NULL AND NEW.person_type NOT IN ('PF','PJ','MEI') THEN
      RAISE EXCEPTION 'tipo de pessoa inválido'; END IF;
    IF NEW.status = 'assinado' AND (NEW.signed_at IS NULL OR NEW.signed_ip IS NULL OR NEW.signed_user_agent IS NULL
        OR NEW.accepted_text_hash IS NULL OR NEW.accepted_phone_last10 IS NULL) THEN
      RAISE EXCEPTION 'contrato assinado exige dados completos do aceite'; END IF;
  ELSE
    IF NEW.status NOT IN ('emprestado','devolvido','extraviado') THEN
      RAISE EXCEPTION 'status de equipamento inválido'; END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER kol_contracts_validate BEFORE INSERT OR UPDATE ON public.kol_contracts FOR EACH ROW EXECUTE FUNCTION public.fn_kol_validate_status();
CREATE TRIGGER kol_equipment_validate BEFORE INSERT OR UPDATE ON public.kol_equipment_loans FOR EACH ROW EXECUTE FUNCTION public.fn_kol_validate_status();

CREATE OR REPLACE FUNCTION public.fn_kol_contract_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ev text;
BEGIN
  IF TG_OP = 'INSERT' THEN ev := 'kol_contract_draft_generated';
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    ev := CASE NEW.status WHEN 'enviado' THEN 'kol_contract_sent'
      WHEN 'ajuste_solicitado' THEN 'kol_contract_adjust_requested'
      WHEN 'assinado' THEN 'kol_contract_signed'
      WHEN 'revogado' THEN 'kol_contract_revoked'
      WHEN 'rascunho' THEN 'kol_contract_draft_generated' END;
  ELSIF NEW.body_rendered IS DISTINCT FROM OLD.body_rendered THEN ev := 'kol_contract_draft_generated';
  END IF;
  IF ev IS NOT NULL THEN
    PERFORM public.fn_kol_log(NEW.lead_id, ev, 'kol_contract', NEW.id::text, 'Contrato KOL '||NEW.template_version,
      jsonb_build_object('status', NEW.status, 'adjust_notes', NEW.adjust_notes), NULL, 'sistema');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER kol_contracts_audit AFTER INSERT OR UPDATE ON public.kol_contracts FOR EACH ROW EXECUTE FUNCTION public.fn_kol_contract_audit();

CREATE OR REPLACE FUNCTION public.fn_kol_equipment_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ev text;
BEGIN
  IF TG_OP = 'INSERT' THEN ev := 'kol_equipment_loaned';
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    ev := CASE NEW.status WHEN 'devolvido' THEN 'kol_equipment_returned' WHEN 'extraviado' THEN 'kol_equipment_lost' ELSE 'kol_equipment_loaned' END;
  END IF;
  IF ev IS NOT NULL THEN
    PERFORM public.fn_kol_log(NEW.lead_id, ev, 'kol_equipment', NEW.id::text, COALESCE(NEW.product_name, NEW.product_id),
      jsonb_build_object('serial', NEW.serial_number, 'status', NEW.status), NEW.value_brl, 'sistema');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER kol_equipment_audit AFTER INSERT OR UPDATE ON public.kol_equipment_loans FOR EACH ROW EXECUTE FUNCTION public.fn_kol_equipment_audit();

CREATE OR REPLACE FUNCTION public.fn_kol_commission_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.prof_kol_commissions IS DISTINCT FROM OLD.prof_kol_commissions THEN
    PERFORM public.fn_kol_log(NEW.id, 'kol_commission_rule_changed', 'kol_commission', NEW.id::text, 'Regras de comissão',
      jsonb_build_object('before', OLD.prof_kol_commissions, 'after', NEW.prof_kol_commissions), NULL, 'sistema');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER lia_kol_commission_audit AFTER UPDATE OF prof_kol_commissions ON public.lia_attendances FOR EACH ROW EXECUTE FUNCTION public.fn_kol_commission_audit();