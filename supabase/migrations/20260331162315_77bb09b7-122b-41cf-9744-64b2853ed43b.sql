SELECT cron.unschedule('omie-sync-morning');
SELECT cron.unschedule('omie-sync-evening');

SELECT cron.schedule(
  'omie-sync-morning',
  '0 12 * * *',
  $$
  SELECT net.http_post(
    url := 'https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/omie-lead-enricher?action=sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1)
    ),
    body := '{"time": "morning-sync"}'::jsonb,
    timeout_milliseconds := 58000
  ) AS request_id;
  $$
);

SELECT cron.schedule(
  'omie-sync-evening',
  '30 20 * * *',
  $$
  SELECT net.http_post(
    url := 'https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/omie-lead-enricher?action=sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1)
    ),
    body := '{"time": "evening-sync"}'::jsonb,
    timeout_milliseconds := 58000
  ) AS request_id;
  $$
);