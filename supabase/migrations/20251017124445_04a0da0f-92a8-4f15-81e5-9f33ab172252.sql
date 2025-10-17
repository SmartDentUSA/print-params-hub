-- Criar tabela de autores
CREATE TABLE public.authors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  specialty TEXT,
  photo_url TEXT,
  mini_bio TEXT,
  full_bio TEXT,
  lattes_url TEXT,
  website_url TEXT,
  instagram_url TEXT,
  youtube_url TEXT,
  facebook_url TEXT,
  linkedin_url TEXT,
  twitter_url TEXT,
  tiktok_url TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.authors ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Allow public read active authors"
  ON public.authors FOR SELECT
  USING (active = true);

CREATE POLICY "Admins can insert authors"
  ON public.authors FOR INSERT
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can update authors"
  ON public.authors FOR UPDATE
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can delete authors"
  ON public.authors FOR DELETE
  USING (is_admin(auth.uid()));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_authors_updated_at
  BEFORE UPDATE ON public.authors
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Adicionar coluna author_id em knowledge_contents
ALTER TABLE public.knowledge_contents
ADD COLUMN author_id UUID REFERENCES public.authors(id) ON DELETE SET NULL;

-- Criar índice para performance
CREATE INDEX idx_knowledge_contents_author_id ON public.knowledge_contents(author_id);