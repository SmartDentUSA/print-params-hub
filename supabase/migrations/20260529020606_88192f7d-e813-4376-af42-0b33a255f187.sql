DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'enrichment-safety-net-every-minute') THEN
    PERFORM cron.unschedule('enrichment-safety-net-every-minute');
  END IF;
END$$;

SELECT cron.schedule(
  'enrichment-safety-net-every-minute',
  '* * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/enrichment-safety-net-cron',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rZW9namdxaWpiZmt1ZGZqYWR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4NzE5MDgsImV4cCI6MjA3MjQ0NzkwOH0.OGdtvsJNdEqAfUoDA4O9OcnD69Titu69TsXS38TaVtk"}'::jsonb,
    body := '{}'::jsonb
  );
  $cron$
);