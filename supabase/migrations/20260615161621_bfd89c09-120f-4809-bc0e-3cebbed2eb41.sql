
CREATE TABLE public.distributors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  razao_social TEXT NOT NULL,
  nome_fantasia TEXT,
  pais TEXT,
  estado TEXT,
  cidade TEXT,
  endereco TEXT,
  cep TEXT,
  numero_unidades INTEGER DEFAULT 1,
  site_url TEXT,
  instagram TEXT,
  facebook TEXT,
  linkedin TEXT,
  youtube TEXT,
  owner_name TEXT,
  owner_email TEXT,
  owner_whatsapp_ddi TEXT,
  owner_whatsapp TEXT,
  buyer_name TEXT,
  buyer_email TEXT,
  buyer_whatsapp_ddi TEXT,
  buyer_whatsapp TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.distributors TO authenticated;
GRANT ALL ON public.distributors TO service_role;

ALTER TABLE public.distributors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read distributors"
  ON public.distributors FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage distributors"
  ON public.distributors FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role::text = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role::text = 'admin'));

CREATE TRIGGER update_distributors_updated_at
  BEFORE UPDATE ON public.distributors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
