-- Fix: Allow authenticated admins to upload to catalog-images bucket
CREATE POLICY "Admins can upload catalog images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'catalog-images' AND (SELECT is_admin(auth.uid())));

CREATE POLICY "Admins can update catalog images"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'catalog-images' AND (SELECT is_admin(auth.uid())));

CREATE POLICY "Admins can delete catalog images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'catalog-images' AND (SELECT is_admin(auth.uid())));