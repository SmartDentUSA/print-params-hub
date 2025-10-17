-- Criar tabela de categorias da Base de Conhecimento
CREATE TABLE knowledge_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  letter TEXT NOT NULL UNIQUE CHECK (letter IN ('A', 'B', 'C', 'D')),
  enabled BOOLEAN DEFAULT true,
  order_index INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Criar tabela de conteúdos
CREATE TABLE knowledge_contents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES knowledge_categories(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  excerpt TEXT NOT NULL,
  content_html TEXT,
  icon_color TEXT DEFAULT 'blue',
  file_url TEXT,
  file_name TEXT,
  meta_description TEXT,
  og_image_url TEXT,
  keywords TEXT[],
  order_index INTEGER NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Criar tabela de vídeos
CREATE TABLE knowledge_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID REFERENCES knowledge_contents(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  order_index INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_knowledge_contents_category ON knowledge_contents(category_id);
CREATE INDEX idx_knowledge_contents_slug ON knowledge_contents(slug);
CREATE INDEX idx_knowledge_contents_active ON knowledge_contents(active);
CREATE INDEX idx_knowledge_videos_content ON knowledge_videos(content_id);

-- Trigger de updated_at para categorias
CREATE TRIGGER update_knowledge_categories_updated_at
  BEFORE UPDATE ON knowledge_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger de updated_at para conteúdos
CREATE TRIGGER update_knowledge_contents_updated_at
  BEFORE UPDATE ON knowledge_contents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS para categorias
ALTER TABLE knowledge_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to categories"
  ON knowledge_categories FOR SELECT
  USING (true);

CREATE POLICY "Admins can update categories"
  ON knowledge_categories FOR UPDATE
  USING (is_admin(auth.uid()));

-- RLS para conteúdos
ALTER TABLE knowledge_contents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read active contents"
  ON knowledge_contents FOR SELECT
  USING (active = true);

CREATE POLICY "Admins can insert contents"
  ON knowledge_contents FOR INSERT
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can update contents"
  ON knowledge_contents FOR UPDATE
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can delete contents"
  ON knowledge_contents FOR DELETE
  USING (is_admin(auth.uid()));

-- RLS para vídeos
ALTER TABLE knowledge_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read videos"
  ON knowledge_videos FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert videos"
  ON knowledge_videos FOR INSERT
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can update videos"
  ON knowledge_videos FOR UPDATE
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can delete videos"
  ON knowledge_videos FOR DELETE
  USING (is_admin(auth.uid()));

-- Inserir categorias padrão
INSERT INTO knowledge_categories (name, letter, order_index, enabled) VALUES
  ('Primeiros Passos', 'A', 1, true),
  ('Configurações Avançadas', 'B', 2, true),
  ('Solução de Problemas', 'C', 3, true),
  ('Dicas e Truques', 'D', 4, true);