select cron.unschedule('classifieds-alerts') where exists (select 1 from cron.job where jobname = 'classifieds-alerts');
select cron.unschedule('classifieds-expire') where exists (select 1 from cron.job where jobname = 'classifieds-expire');

select cron.schedule(
  'classifieds-alerts',
  '13 */2 * * *',
  $$
  select net.http_post(
    url := 'https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/classifieds-alerts',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
  $$
);

select cron.schedule(
  'classifieds-expire',
  '17 12 * * *',
  $$
  select net.http_post(
    url := 'https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/classifieds-expire',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
  $$
);