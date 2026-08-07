select cron.unschedule('social-inbox-sync') where exists (select 1 from cron.job where jobname = 'social-inbox-sync');

select cron.schedule(
  'social-inbox-sync',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/social-inbox-sync',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('limit', 40, 'messages', 30, 'sinceHours', 12),
    timeout_milliseconds := 55000
  );
  $$
);