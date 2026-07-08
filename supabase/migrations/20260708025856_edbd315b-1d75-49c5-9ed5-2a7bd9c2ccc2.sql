
CREATE POLICY "landing-page-media public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'landing-page-media');

CREATE POLICY "landing-page-media auth insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'landing-page-media');

CREATE POLICY "landing-page-media auth update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'landing-page-media')
WITH CHECK (bucket_id = 'landing-page-media');

CREATE POLICY "landing-page-media auth delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'landing-page-media');
