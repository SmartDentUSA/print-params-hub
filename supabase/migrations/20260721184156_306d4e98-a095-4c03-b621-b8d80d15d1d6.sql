
CREATE TABLE IF NOT EXISTS public.piperun_companies_mirror (
  piperun_company_id BIGINT PRIMARY KEY,
  nome TEXT,
  nome_fantasia TEXT,
  razao_social TEXT,
  cnpj TEXT,
  cnpj_digits TEXT,
  cidade TEXT,
  uf TEXT,
  segmento TEXT,
  website TEXT,
  email_contato TEXT,
  telefone_principal TEXT,
  status TEXT,
  data_cadastro TIMESTAMPTZ,
  raw JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS piperun_companies_mirror_cnpj_digits_idx ON public.piperun_companies_mirror (cnpj_digits) WHERE cnpj_digits IS NOT NULL;
CREATE INDEX IF NOT EXISTS piperun_companies_mirror_nome_idx ON public.piperun_companies_mirror (lower(nome));

GRANT SELECT ON public.piperun_companies_mirror TO authenticated;
GRANT ALL ON public.piperun_companies_mirror TO service_role;
ALTER TABLE public.piperun_companies_mirror ENABLE ROW LEVEL SECURITY;
CREATE POLICY "companies_mirror_read_authenticated" ON public.piperun_companies_mirror FOR SELECT TO authenticated USING (true);
CREATE POLICY "companies_mirror_service_role_all" ON public.piperun_companies_mirror FOR ALL TO service_role USING (true) WITH CHECK (true);


CREATE TABLE IF NOT EXISTS public.piperun_persons_mirror (
  piperun_person_id BIGINT PRIMARY KEY,
  nome TEXT,
  cpf TEXT,
  cpf_digits TEXT,
  email TEXT,
  email_normalized TEXT,
  telefone TEXT,
  telefone_principal TEXT,
  phone_digits TEXT,
  phone_last10 TEXT,
  cargo TEXT,
  cargo_empresa TEXT,
  data_nascimento DATE,
  cliente_desde TIMESTAMPTZ,
  data_cadastro TIMESTAMPTZ,
  tags TEXT,
  origem_dados TEXT,
  observacoes TEXT,
  piperun_company_id BIGINT REFERENCES public.piperun_companies_mirror(piperun_company_id) ON DELETE SET NULL,
  empresa_nome TEXT,
  empresa_cnpj_digits TEXT,
  area_atuacao TEXT,
  especialidade TEXT,
  scanner_form TEXT,
  impressora_form TEXT,
  tem_scanner TEXT,
  tem_impressora TEXT,
  id_banco_dados TEXT,
  lia_attendance_id UUID,
  raw JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS piperun_persons_mirror_email_idx ON public.piperun_persons_mirror (email_normalized) WHERE email_normalized IS NOT NULL;
CREATE INDEX IF NOT EXISTS piperun_persons_mirror_phone10_idx ON public.piperun_persons_mirror (phone_last10) WHERE phone_last10 IS NOT NULL;
CREATE INDEX IF NOT EXISTS piperun_persons_mirror_cpf_idx ON public.piperun_persons_mirror (cpf_digits) WHERE cpf_digits IS NOT NULL;
CREATE INDEX IF NOT EXISTS piperun_persons_mirror_company_idx ON public.piperun_persons_mirror (piperun_company_id) WHERE piperun_company_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS piperun_persons_mirror_nome_idx ON public.piperun_persons_mirror (lower(nome));
CREATE INDEX IF NOT EXISTS piperun_persons_mirror_lia_idx ON public.piperun_persons_mirror (lia_attendance_id) WHERE lia_attendance_id IS NOT NULL;

GRANT SELECT ON public.piperun_persons_mirror TO authenticated;
GRANT ALL ON public.piperun_persons_mirror TO service_role;
ALTER TABLE public.piperun_persons_mirror ENABLE ROW LEVEL SECURITY;
CREATE POLICY "persons_mirror_read_authenticated" ON public.piperun_persons_mirror FOR SELECT TO authenticated USING (true);
CREATE POLICY "persons_mirror_service_role_all" ON public.piperun_persons_mirror FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;
CREATE TRIGGER update_piperun_persons_mirror_updated_at BEFORE UPDATE ON public.piperun_persons_mirror FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_piperun_companies_mirror_updated_at BEFORE UPDATE ON public.piperun_companies_mirror FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
