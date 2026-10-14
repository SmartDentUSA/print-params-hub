ALTER TABLE public.kol_commission_templates ADD COLUMN IF NOT EXISTS values_are_test boolean NOT NULL DEFAULT false;
UPDATE public.kol_commission_templates SET values_are_test = true WHERE is_default;

ALTER TABLE public.kol_contracts
  ADD COLUMN IF NOT EXISTS commission_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS rep_name text,
  ADD COLUMN IF NOT EXISTS rep_cpf text,
  ADD COLUMN IF NOT EXISTS number text;
CREATE UNIQUE INDEX IF NOT EXISTS kol_contracts_number_uidx ON public.kol_contracts(number) WHERE number IS NOT NULL;

CREATE TABLE public.kol_contract_addenda (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.kol_contracts(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL,
  kind text NOT NULL,
  number text,
  status text NOT NULL DEFAULT 'rascunho',
  commission_before jsonb,
  commission_after jsonb,
  equipment_loan_ids uuid[],
  body_rendered text,
  pdf_url text,
  accepted_text_hash text,
  sent_at timestamptz,
  accepted_at timestamptz,
  accepted_ip text,
  accepted_user_agent text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kol_contract_addenda TO authenticated;
GRANT ALL ON public.kol_contract_addenda TO service_role;
ALTER TABLE public.kol_contract_addenda ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage KOL addenda" ON public.kol_contract_addenda FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.fn_kol_addendum_validate()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.kind NOT IN ('comissionamento','equipamento') THEN RAISE EXCEPTION 'Tipo de aditivo inválido: %', NEW.kind; END IF;
  IF NEW.status NOT IN ('rascunho','enviado','aceito','cancelado') THEN RAISE EXCEPTION 'Status de aditivo inválido: %', NEW.status; END IF;
  IF NEW.status = 'aceito' AND NEW.accepted_at IS NULL THEN NEW.accepted_at := now(); END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER trg_kol_addendum_validate BEFORE INSERT OR UPDATE ON public.kol_contract_addenda
  FOR EACH ROW EXECUTE FUNCTION public.fn_kol_addendum_validate();

CREATE OR REPLACE FUNCTION public.fn_kol_addendum_log()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.fn_kol_log(NEW.lead_id, 'kol_addendum_created', 'kol_addendum', NEW.id::text, 'Aditivo '||NEW.kind,
      jsonb_build_object('kind', NEW.kind, 'contract_id', NEW.contract_id), NULL, 'sistema');
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.fn_kol_log(NEW.lead_id, 'kol_addendum_'||NEW.status, 'kol_addendum', NEW.id::text, 'Aditivo '||NEW.kind,
      jsonb_build_object('before', OLD.status, 'after', NEW.status), NULL, 'sistema');
    IF NEW.status = 'aceito' AND NEW.kind = 'comissionamento' THEN
      UPDATE public.kol_contracts SET commission_addendum_accepted_at = NEW.accepted_at,
        commission_snapshot = COALESCE(NEW.commission_after, commission_snapshot) WHERE id = NEW.contract_id;
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_kol_addendum_log AFTER INSERT OR UPDATE ON public.kol_contract_addenda
  FOR EACH ROW EXECUTE FUNCTION public.fn_kol_addendum_log();