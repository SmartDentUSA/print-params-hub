-- Escrita restrita ao dono, dentro de classifieds/<uid>/...
DROP POLICY IF EXISTS "Classifieds owners upload own images" ON storage.objects;
CREATE POLICY "Classifieds owners upload own images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'catalog-images'
    AND (storage.foldername(name))[1] = 'classifieds'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Classifieds owners update own images" ON storage.objects;
CREATE POLICY "Classifieds owners update own images" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'catalog-images'
    AND (storage.foldername(name))[1] = 'classifieds'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Classifieds owners delete own images" ON storage.objects;
CREATE POLICY "Classifieds owners delete own images" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'catalog-images'
    AND (storage.foldername(name))[1] = 'classifieds'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );