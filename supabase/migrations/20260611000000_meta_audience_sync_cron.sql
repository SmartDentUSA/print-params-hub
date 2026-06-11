-- Agenda a sincronização diária do Custom Audience Meta às 00:00 BRT (03:00 UTC)
SELECT cron.schedule(
  'meta-audience-sync-daily',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/meta-audience-sync',
    body    := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret
        FROM vault.decrypted_secrets
        WHERE name = 'service_role_key'
        LIMIT 1
      )
    )
  );
  $$
);
