-- FASE 2.1: Adicionar campos SEO extras na tabela resins
-- Estes campos existem no Sistema A (Knowledge Base API) mas não no Sistema B

ALTER TABLE resins
ADD COLUMN IF NOT EXISTS seo_title_override TEXT,
ADD COLUMN IF NOT EXISTS canonical_url TEXT,
ADD COLUMN IF NOT EXISTS slug TEXT;

-- Índices para otimização de busca
CREATE INDEX IF NOT EXISTS idx_resins_slug ON resins(slug);
CREATE INDEX IF NOT EXISTS idx_resins_canonical_url ON resins(canonical_url);

-- Comentários explicativos
COMMENT ON COLUMN resins.seo_title_override IS 'Título SEO customizado (importado do Sistema A - Knowledge Base)';
COMMENT ON COLUMN resins.canonical_url IS 'URL canônica para evitar conteúdo duplicado (importado do Sistema A)';
COMMENT ON COLUMN resins.slug IS 'Slug do produto para URLs amigáveis (importado do Sistema A)';