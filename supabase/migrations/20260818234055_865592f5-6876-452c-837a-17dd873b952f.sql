select cron.unschedule('training-testimonial-auto-process');

select cron.schedule(
  'training-testimonial-auto-process',
  '*/2 * * * *',
  $$
  select net.http_post(
    url := 'https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/training-testimonial-auto-process',
    headers := '{"Content-Type":"application/json","x-cron-key":"e977477eefb1f69cbba62edfd21bb682a8df4a8cce58b0bc"}'::jsonb,
    body := '{"limit":3}'::jsonb
  );
  $$
);