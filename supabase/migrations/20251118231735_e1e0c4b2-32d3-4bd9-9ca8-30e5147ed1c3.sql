-- 1. Criar bucket público para imagens do catálogo
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'catalog-images',
  'catalog-images',
  true,
  10485760, -- 10MB
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
);

-- 2. Política: Qualquer pessoa pode ler
CREATE POLICY "Public read access for catalog images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'catalog-images');

-- 3. Política: Service role pode fazer upload
CREATE POLICY "Service role upload access for catalog images"
ON storage.objects FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'catalog-images');

-- 4. Política: Service role pode deletar
CREATE POLICY "Service role delete access for catalog images"
ON storage.objects FOR DELETE
TO service_role
USING (bucket_id = 'catalog-images');