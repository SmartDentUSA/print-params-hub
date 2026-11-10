-- lovable-cron-fallback-reviewed: Google Drive gives no push for new Gemini notes in a shared folder; job exits after one indexed query when no meeting ended in the last 4 days, and reports must reach the CRM within ~15 min
SELECT cron.schedule(
  'blueprint-meeting-analyzer-15min',
  '4,19,34,49 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/blueprint-meeting-analyzer',
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1)
    )
  );
  $$
);