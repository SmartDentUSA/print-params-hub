-- Tornar bucket resin-documents público
UPDATE storage.buckets 
SET public = true 
WHERE name = 'resin-documents';

-- Remover policy antiga se existir e criar nova para leitura pública
DROP POLICY IF EXISTS "Public read access to resin documents" ON storage.objects;

CREATE POLICY "Public read access to resin documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'resin-documents');