
select cron.schedule(
  'poll-loja-integrada-orders-5min',
  '*/5 * * * *',
  $$
  select
    net.http_post(
        url:='https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/poll-loja-integrada-orders',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rZW9namdxaWpiZmt1ZGZqYWR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4NzE5MDgsImV4cCI6MjA3MjQ0NzkwOH0.OGdtvsJNdEqAfUoDA4O9OcnD69Titu69TsXS38TaVtk"}'::jsonb,
        body:='{"batch_size": 50}'::jsonb
    ) as request_id;
  $$
);
