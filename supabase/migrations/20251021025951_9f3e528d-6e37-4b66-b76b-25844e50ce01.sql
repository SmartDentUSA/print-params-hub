-- FASE 1: Criar tabela external_links (Keywords Repository)
CREATE TABLE public.external_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Campos básicos
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  description TEXT,
  category TEXT,
  subcategory TEXT,
  approved BOOLEAN DEFAULT false,
  
  -- Campos de classificação SEO
  keyword_type TEXT CHECK (keyword_type IN ('primary', 'secondary', 'long-tail', 'negative')),
  search_intent TEXT CHECK (search_intent IN ('informational', 'commercial', 'transactional', 'navigational')),
  
  -- Métricas SEO
  monthly_searches INTEGER DEFAULT 0,
  cpc_estimate DECIMAL(10,2),
  competition_level TEXT CHECK (competition_level IN ('low', 'medium', 'high')),
  relevance_score INTEGER CHECK (relevance_score >= 0 AND relevance_score <= 100),
  
  -- Relacionamentos
  related_keywords TEXT[],
  source_products UUID[],
  
  -- Tracking de uso
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  ai_generated BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_external_links_approved ON public.external_links(approved);
CREATE INDEX idx_external_links_keyword_type ON public.external_links(keyword_type);
CREATE INDEX idx_external_links_relevance_score ON public.external_links(relevance_score);
CREATE INDEX idx_external_links_name ON public.external_links(name);
CREATE INDEX idx_external_links_related_keywords ON public.external_links USING GIN(related_keywords);

-- RLS Policies
ALTER TABLE public.external_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read approved links"
  ON public.external_links FOR SELECT
  USING (approved = true);

CREATE POLICY "Admins can manage links"
  ON public.external_links FOR ALL
  USING (is_admin(auth.uid()));

-- Trigger para updated_at
CREATE TRIGGER update_external_links_updated_at
  BEFORE UPDATE ON public.external_links
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- FASE 2: Adicionar keyword_ids nas tabelas existentes
ALTER TABLE public.resins 
  ADD COLUMN keyword_ids UUID[];

CREATE INDEX idx_resins_keyword_ids ON public.resins USING GIN(keyword_ids);

COMMENT ON COLUMN public.resins.keyword_ids IS 'Array de UUIDs referenciando external_links (Keywords Repository)';

ALTER TABLE public.knowledge_contents 
  ADD COLUMN keyword_ids UUID[];

CREATE INDEX idx_knowledge_contents_keyword_ids ON public.knowledge_contents USING GIN(keyword_ids);

COMMENT ON COLUMN public.knowledge_contents.keyword_ids IS 'Array de UUIDs referenciando external_links (Keywords Repository)';