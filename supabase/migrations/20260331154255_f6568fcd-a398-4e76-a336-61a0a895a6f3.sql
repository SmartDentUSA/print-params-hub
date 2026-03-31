
-- Reconfigure Omie sync cron jobs to use action=sync (incremental) and service_role key
-- First unschedule existing jobs if they exist
SELECT cron.unschedule('omie-sync-morning');
SELECT cron.unschedule('omie-sync-evening');

-- Recreate morning sync at 09:00 BRT (12:00 UTC) with service_role key and extended timeout
SELECT cron.schedule(
  'omie-sync-morning',
  '0 12 * * *',
  $$
  SELECT net.http_post(
    url := 'https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/omie-lead-enricher?action=sync',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rZW9namdxaWpiZmt1ZGZqYWR6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Njg3MTkwOCwiZXhwIjoyMDcyNDQ3OTA4fQ.LpJuNMBFST_GJjjNdNQ_QkPTKQw35ErAGEYmpNnoGLo"}'::jsonb,
    body := '{"time": "morning-sync"}'::jsonb,
    timeout_milliseconds := 58000
  ) AS request_id;
  $$
);

-- Recreate evening sync at 17:30 BRT (20:30 UTC) with service_role key and extended timeout
SELECT cron.schedule(
  'omie-sync-evening',
  '30 20 * * *',
  $$
  SELECT net.http_post(
    url := 'https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/omie-lead-enricher?action=sync',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rZW9namdxaWpiZmt1ZGZqYWR6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Njg3MTkwOCwiZXhwIjoyMDcyNDQ3OTA4fQ.LpJuNMBFST_GJjjNdNQ_QkPTKQw35ErAGEYmpNnoGLo"}'::jsonb,
    body := '{"time": "evening-sync"}'::jsonb,
    timeout_milliseconds := 58000
  ) AS request_id;
  $$
);
