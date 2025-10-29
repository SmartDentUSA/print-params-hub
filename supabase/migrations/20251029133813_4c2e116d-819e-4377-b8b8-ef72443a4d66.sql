-- Criar tabela para documentos técnicos de resinas
CREATE TABLE public.resin_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resin_id UUID NOT NULL REFERENCES public.resins(id) ON DELETE CASCADE,
  document_name TEXT NOT NULL,
  document_description TEXT,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  order_index INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_resin_documents_resin_id ON public.resin_documents(resin_id);
CREATE INDEX idx_resin_documents_active ON public.resin_documents(active);

-- Trigger de updated_at
CREATE TRIGGER update_resin_documents_updated_at
  BEFORE UPDATE ON public.resin_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies
ALTER TABLE public.resin_documents ENABLE ROW LEVEL SECURITY;

-- Leitura pública de documentos ativos
CREATE POLICY "Allow public read active resin documents"
  ON public.resin_documents
  FOR SELECT
  USING (active = true);

-- Admins podem fazer tudo
CREATE POLICY "Admins can manage resin documents"
  ON public.resin_documents
  FOR ALL
  USING (is_admin(auth.uid()));

-- Criar bucket para documentos técnicos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'resin-documents',
  'resin-documents',
  true,
  5242880,
  ARRAY['application/pdf']::text[]
);

-- RLS para permitir leitura pública
CREATE POLICY "Allow public read resin documents"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'resin-documents');

-- RLS para admins fazerem upload
CREATE POLICY "Admins can upload resin documents"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'resin-documents' AND 
    is_admin(auth.uid())
  );

-- RLS para admins deletarem
CREATE POLICY "Admins can delete resin documents"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'resin-documents' AND 
    is_admin(auth.uid())
  );