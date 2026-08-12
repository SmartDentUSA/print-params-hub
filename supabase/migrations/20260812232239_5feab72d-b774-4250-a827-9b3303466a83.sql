select cron.unschedule('cs-nps-sms-followup-daily') where exists (select 1 from cron.job where jobname = 'cs-nps-sms-followup-daily');

select cron.schedule(
  'cs-nps-sms-followup-daily',
  '0 11 * * *',
  $$
  select net.http_post(
    url := 'https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/cs-nps-sms-followup',
    headers := jsonb_build_object('Content-Type','application/json'),
    body := '{}'::jsonb
  );
  $$
);