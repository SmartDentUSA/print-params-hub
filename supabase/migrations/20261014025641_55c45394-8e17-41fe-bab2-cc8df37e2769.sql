CREATE TABLE public.kol_contestations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL,
  subject_type text NOT NULL DEFAULT 'venda',
  subject_ref text,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'aberta',
  staff_response text,
  is_test boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.kol_contestations TO authenticated;
GRANT ALL ON public.kol_contestations TO service_role;
ALTER TABLE public.kol_contestations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read KOL contestations" ON public.kol_contestations FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins answer KOL contestations" ON public.kol_contestations FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE INDEX ON public.kol_contestations(lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS kol_access_sessions_token_hash_idx ON public.kol_access_sessions(token_hash);