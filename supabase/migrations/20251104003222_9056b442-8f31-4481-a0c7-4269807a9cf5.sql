-- ========================================
-- MIGRATION: Criar sistema de catálogo de produtos
-- ========================================

-- 1️⃣ Adicionar colunas para categoria/subcategoria na system_a_catalog
ALTER TABLE public.system_a_catalog
ADD COLUMN IF NOT EXISTS product_category TEXT,
ADD COLUMN IF NOT EXISTS product_subcategory TEXT;

-- 2️⃣ Migrar dados existentes do extra_data para as novas colunas
UPDATE public.system_a_catalog
SET 
  product_category = extra_data->>'category',
  product_subcategory = extra_data->>'subcategory'
WHERE category = 'product' AND extra_data IS NOT NULL;

-- 3️⃣ Criar índices para melhorar performance de filtros
CREATE INDEX IF NOT EXISTS idx_system_a_catalog_product_category 
  ON public.system_a_catalog(product_category);
CREATE INDEX IF NOT EXISTS idx_system_a_catalog_product_subcategory 
  ON public.system_a_catalog(product_subcategory);

-- 4️⃣ Criar tabela de documentos de produtos do catálogo
CREATE TABLE IF NOT EXISTS public.catalog_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.system_a_catalog(id) ON DELETE CASCADE,
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

-- 5️⃣ Enable RLS na tabela catalog_documents
ALTER TABLE public.catalog_documents ENABLE ROW LEVEL SECURITY;

-- 6️⃣ RLS Policies para catalog_documents
CREATE POLICY "Admins can manage catalog documents" 
  ON public.catalog_documents
  FOR ALL 
  USING (is_admin(auth.uid()));

CREATE POLICY "Allow public read active catalog documents" 
  ON public.catalog_documents
  FOR SELECT 
  USING (active = true);

-- 7️⃣ Criar índices para catalog_documents
CREATE INDEX IF NOT EXISTS idx_catalog_documents_product_id 
  ON public.catalog_documents(product_id);
CREATE INDEX IF NOT EXISTS idx_catalog_documents_active 
  ON public.catalog_documents(active);

-- 8️⃣ Criar bucket para documentos de produtos do catálogo
INSERT INTO storage.buckets (id, name, public)
VALUES ('catalog-documents', 'catalog-documents', true)
ON CONFLICT (id) DO NOTHING;

-- 9️⃣ RLS Policies para o bucket catalog-documents
CREATE POLICY "Admins can upload catalog documents"
  ON storage.objects 
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'catalog-documents' AND
    is_admin(auth.uid())
  );

CREATE POLICY "Admins can delete catalog documents"
  ON storage.objects 
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'catalog-documents' AND
    is_admin(auth.uid())
  );

CREATE POLICY "Public can view catalog documents"
  ON storage.objects 
  FOR SELECT
  USING (bucket_id = 'catalog-documents');