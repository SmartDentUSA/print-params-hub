
ALTER TABLE public.distributors ADD COLUMN IF NOT EXISTS logo_url TEXT;

DROP POLICY IF EXISTS "Public read distributor logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload distributor logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update distributor logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete distributor logos" ON storage.objects;

CREATE POLICY "Public read distributor logos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'distributor-logos');

CREATE POLICY "Authenticated upload distributor logos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'distributor-logos');

CREATE POLICY "Authenticated update distributor logos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'distributor-logos');

CREATE POLICY "Authenticated delete distributor logos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'distributor-logos');
