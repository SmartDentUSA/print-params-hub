-- ============================================================
-- KNOWLEDGE HUB v1: FAQ comercial + Fichas Técnicas + Casos de Sucesso
-- ============================================================

-- 1) Commercial FAQs ------------------------------------------------
CREATE TABLE IF NOT EXISTS public.commercial_faqs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  category TEXT,
  tags TEXT[] DEFAULT '{}',
  product_refs TEXT[] DEFAULT '{}',
  priority INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  view_count INT NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.commercial_faqs TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commercial_faqs TO authenticated;
GRANT ALL ON public.commercial_faqs TO service_role;

ALTER TABLE public.commercial_faqs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "FAQs ativas são públicas"
  ON public.commercial_faqs FOR SELECT
  USING (active = true);

CREATE POLICY "Authenticated podem gerenciar FAQs"
  ON public.commercial_faqs FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_commercial_faqs_active_priority
  ON public.commercial_faqs (active, priority DESC);
CREATE INDEX IF NOT EXISTS idx_commercial_faqs_category
  ON public.commercial_faqs (category) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_commercial_faqs_fts
  ON public.commercial_faqs USING gin (to_tsvector('portuguese', coalesce(question,'') || ' ' || coalesce(answer,'')));

CREATE TRIGGER trg_commercial_faqs_updated
  BEFORE UPDATE ON public.commercial_faqs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Success Stories -----------------------------------------------
CREATE TABLE IF NOT EXISTS public.success_stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  client_name TEXT NOT NULL,
  client_role TEXT,
  segment TEXT,            -- 'clinica' | 'laboratorio' | 'dentista_solo' | 'rede' | 'protetico'
  city TEXT,
  state TEXT,
  challenge TEXT,
  solution TEXT,
  results JSONB DEFAULT '{}'::jsonb,   -- {roi_meses, economia_mensal_brl, tempo_reducao_pct, ...}
  products_used TEXT[] DEFAULT '{}',
  testimonial TEXT,
  video_url TEXT,
  image_url TEXT,
  published BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.success_stories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.success_stories TO authenticated;
GRANT ALL ON public.success_stories TO service_role;

ALTER TABLE public.success_stories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Casos publicados são públicos"
  ON public.success_stories FOR SELECT
  USING (published = true);

CREATE POLICY "Authenticated gerencia casos"
  ON public.success_stories FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_success_stories_published
  ON public.success_stories (published, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_success_stories_segment
  ON public.success_stories (segment) WHERE published = true;
CREATE INDEX IF NOT EXISTS idx_success_stories_fts
  ON public.success_stories USING gin (to_tsvector('portuguese',
    coalesce(client_name,'') || ' ' || coalesce(challenge,'') || ' ' ||
    coalesce(solution,'') || ' ' || coalesce(testimonial,'')));

CREATE TRIGGER trg_success_stories_updated
  BEFORE UPDATE ON public.success_stories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Fichas técnicas em products_catalog ---------------------------
ALTER TABLE public.products_catalog
  ADD COLUMN IF NOT EXISTS datasheet_url TEXT,
  ADD COLUMN IF NOT EXISTS spec_sheet_url TEXT,
  ADD COLUMN IF NOT EXISTS manual_url TEXT,
  ADD COLUMN IF NOT EXISTS datasheet_summary TEXT;

-- 4) Storage bucket público para datasheets ------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-datasheets', 'product-datasheets', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Datasheets são públicos para leitura"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'product-datasheets');

CREATE POLICY "Authenticated faz upload de datasheets"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'product-datasheets');

CREATE POLICY "Authenticated atualiza datasheets"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'product-datasheets');

CREATE POLICY "Authenticated deleta datasheets"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'product-datasheets');