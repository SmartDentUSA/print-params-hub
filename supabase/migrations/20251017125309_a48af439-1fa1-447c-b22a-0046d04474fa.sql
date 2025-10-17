-- Criar bucket para fotos de autores
INSERT INTO storage.buckets (id, name, public)
VALUES ('author-images', 'author-images', true);

-- Políticas RLS para permitir upload (apenas admins)
CREATE POLICY "Admins can upload author images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'author-images' 
  AND is_admin(auth.uid())
);

CREATE POLICY "Public can view author images"
ON storage.objects FOR SELECT
USING (bucket_id = 'author-images');

CREATE POLICY "Admins can update author images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'author-images' 
  AND is_admin(auth.uid())
);

CREATE POLICY "Admins can delete author images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'author-images' 
  AND is_admin(auth.uid())
);