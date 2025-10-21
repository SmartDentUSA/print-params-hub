-- Criar tabela system_a_catalog para armazenar dados do Sistema A
CREATE TABLE IF NOT EXISTS public.system_a_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identificação e Controle
  external_id TEXT NOT NULL UNIQUE, -- ID original do Sistema A
  source TEXT NOT NULL DEFAULT 'system_a',
  category TEXT NOT NULL, -- company_info, resin, printer, accessory, video_testimonial, google_review, kol, landing_page, category_config
  
  -- Campos Principais (uso frequente)
  name TEXT NOT NULL,
  slug TEXT,
  description TEXT,
  image_url TEXT,
  price NUMERIC,
  promo_price NUMERIC,
  currency TEXT DEFAULT 'BRL',
  
  -- SEO Direto
  seo_title_override TEXT,
  meta_description TEXT,
  canonical_url TEXT,
  og_image_url TEXT,
  keywords TEXT[] DEFAULT '{}',
  keyword_ids UUID[] DEFAULT '{}', -- Relacionamento com external_links
  
  -- CTAs (3 conjuntos completos)
  cta_1_label TEXT,
  cta_1_url TEXT,
  cta_1_description TEXT,
  cta_2_label TEXT,
  cta_2_url TEXT,
  cta_2_description TEXT,
  cta_3_label TEXT,
  cta_3_url TEXT,
  cta_3_description TEXT,
  
  -- Status e Controle
  approved BOOLEAN DEFAULT true,
  active BOOLEAN DEFAULT true,
  visible_in_ui BOOLEAN DEFAULT false, -- Sempre false para esta tabela
  display_order INTEGER DEFAULT 0,
  
  -- Reviews/Ratings
  rating NUMERIC,
  review_count INTEGER DEFAULT 0,
  
  -- Dados Flexíveis (231+ campos restantes)
  extra_data JSONB DEFAULT '{}'::jsonb,
  
  -- Sincronização
  last_sync_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_system_a_catalog_external_id ON public.system_a_catalog(external_id);
CREATE INDEX IF NOT EXISTS idx_system_a_catalog_category ON public.system_a_catalog(category);
CREATE INDEX IF NOT EXISTS idx_system_a_catalog_slug ON public.system_a_catalog(slug);
CREATE INDEX IF NOT EXISTS idx_system_a_catalog_approved_active ON public.system_a_catalog(approved, active);
CREATE INDEX IF NOT EXISTS idx_system_a_catalog_keyword_ids ON public.system_a_catalog USING GIN(keyword_ids);
CREATE INDEX IF NOT EXISTS idx_system_a_catalog_extra_data ON public.system_a_catalog USING GIN(extra_data);

-- Trigger para updated_at
CREATE TRIGGER update_system_a_catalog_updated_at
  BEFORE UPDATE ON public.system_a_catalog
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies
ALTER TABLE public.system_a_catalog ENABLE ROW LEVEL SECURITY;

-- Leitura pública para dados aprovados e ativos
CREATE POLICY "Allow public read active catalog items"
  ON public.system_a_catalog
  FOR SELECT
  USING (approved = true AND active = true);

-- Admins podem tudo
CREATE POLICY "Admins can manage catalog"
  ON public.system_a_catalog
  FOR ALL
  USING (is_admin(auth.uid()));

-- Comentários para documentação
COMMENT ON TABLE public.system_a_catalog IS 'Repositório universal de dados do Sistema A (produtos, empresa, reviews, KOLs, etc.) para IA e SEO';
COMMENT ON COLUMN public.system_a_catalog.extra_data IS 'JSONB flexível contendo os 231+ campos adicionais do Sistema A organizados por seção';
COMMENT ON COLUMN public.system_a_catalog.visible_in_ui IS 'Sempre false - esta tabela é apenas para IA e geração de páginas SEO';
COMMENT ON COLUMN public.system_a_catalog.keyword_ids IS 'Array de UUIDs vinculando aos external_links para internal linking automático';