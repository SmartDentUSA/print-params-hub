SELECT cron.unschedule('retry-failed-leads-daily');

SELECT cron.schedule(
  'retry-failed-leads-15min',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/smart-ops-piperun-retry-failed-leads',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||current_setting('app.service_role_key',true)),
    body := '{"limit":50,"lookback_days":7}'::jsonb
  );
  $$
);