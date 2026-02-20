
CREATE TABLE public.company_kb_texts (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title        text NOT NULL,
  category     text NOT NULL,
  source_label text,
  content      text NOT NULL,
  active       boolean DEFAULT true,
  chunks_count integer DEFAULT 0,
  indexed_at   timestamptz,
  created_at   timestamptz DEFAULT now(),
  CONSTRAINT company_kb_texts_category_check
    CHECK (category IN ('sdr','comercial','workflow','suporte','faq','objecoes','onboarding','geral'))
);

ALTER TABLE public.company_kb_texts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage kb texts"
  ON public.company_kb_texts FOR ALL
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));
