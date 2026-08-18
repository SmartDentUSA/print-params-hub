select cron.schedule(
  'training-testimonial-auto-process',
  '*/2 * * * *',
  $$
  select net.http_post(
    url := 'https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/training-testimonial-auto-process',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := jsonb_build_object('limit', 3)
  );
  $$
);