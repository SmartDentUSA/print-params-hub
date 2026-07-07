SELECT cron.unschedule('social-post-auto-blast-10min') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='social-post-auto-blast-10min');
SELECT cron.schedule(
  'social-post-auto-blast-10min',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url:='https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/social-post-auto-blast',
    headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || current_setting('app.settings.service_role_key', true)),
    body:='{}'::jsonb
  );
  $$
);