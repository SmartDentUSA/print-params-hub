ALTER TABLE public.smartops_forms DROP CONSTRAINT IF EXISTS smartops_forms_form_purpose_check;
ALTER TABLE public.smartops_forms ADD CONSTRAINT smartops_forms_form_purpose_check CHECK (form_purpose = ANY (ARRAY['nps','sdr','roi','cs','captacao','evento','sdr_captacao','cm_update_deal','cs_update_deals','st_update_deals','feira_evento','credenciamento','distribuicao','insercao_crm']::text[]));

CREATE TABLE public.crm_insertion_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid,
  team_member_id uuid,
  action text NOT NULL,
  lead_phone text,
  lead_id uuid,
  kol_lead_id uuid,
  indicacao_tipo text,
  origin_name text,
  target_seller_team_member_id uuid,
  outcome text NOT NULL,
  conflict jsonb,
  result jsonb,
  emails_sent jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.crm_insertion_log TO authenticated;
GRANT ALL ON public.crm_insertion_log TO service_role;
ALTER TABLE public.crm_insertion_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read CRM insertion log" ON public.crm_insertion_log
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX crm_insertion_log_user_time_idx ON public.crm_insertion_log (auth_user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.update_crm_insertion_log_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER trg_crm_insertion_log_updated_at BEFORE UPDATE ON public.crm_insertion_log
  FOR EACH ROW EXECUTE FUNCTION public.update_crm_insertion_log_updated_at();