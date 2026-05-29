-- Storage bucket for WhatsApp media (images, videos, audios, documents)
-- Public so Evolution API can fetch the media URL when sending messages.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'wa-media',
  'wa-media',
  true,
  104857600, -- 100 MB
  ARRAY[
    'image/png','image/jpeg','image/jpg','image/webp','image/gif',
    'video/mp4','video/quicktime','video/webm','video/3gpp',
    'audio/mpeg','audio/mp3','audio/ogg','audio/wav','audio/webm','audio/mp4','audio/aac',
    'application/pdf','application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip','text/plain','text/csv'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Public read (bucket is public, but keep explicit policy)
DROP POLICY IF EXISTS "wa-media public read" ON storage.objects;
CREATE POLICY "wa-media public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'wa-media');

-- Authenticated users can upload
DROP POLICY IF EXISTS "wa-media authenticated upload" ON storage.objects;
CREATE POLICY "wa-media authenticated upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'wa-media');

-- Authenticated users can update/delete
DROP POLICY IF EXISTS "wa-media authenticated update" ON storage.objects;
CREATE POLICY "wa-media authenticated update" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'wa-media');

DROP POLICY IF EXISTS "wa-media authenticated delete" ON storage.objects;
CREATE POLICY "wa-media authenticated delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'wa-media');