DO $$
DECLARE
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rZW9namdxaWpiZmt1ZGZqYWR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4NzE5MDgsImV4cCI6MjA3MjQ0NzkwOH0.OGdtvsJNdEqAfUoDA4O9OcnD69Titu69TsXS38TaVtk';
  base text := 'https://okeogjgqijbfkudfjadz.supabase.co/functions/v1';
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'flow-executor') THEN PERFORM cron.unschedule('flow-executor'); END IF;
  PERFORM cron.schedule('flow-executor', '* * * * *',
    format($f$ SELECT net.http_post(url:=%L, headers:=%L::jsonb, body:='{}'::jsonb); $f$,
      base || '/flow-executor',
      json_build_object('Content-Type','application/json','apikey',anon_key)::text));

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sequence-runner') THEN PERFORM cron.unschedule('sequence-runner'); END IF;
  PERFORM cron.schedule('sequence-runner', '* * * * *',
    format($f$ SELECT net.http_post(url:=%L, headers:=%L::jsonb, body:='{}'::jsonb); $f$,
      base || '/sequence-runner',
      json_build_object('Content-Type','application/json','apikey',anon_key)::text));

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'wa-broadcast-cron') THEN PERFORM cron.unschedule('wa-broadcast-cron'); END IF;
  PERFORM cron.schedule('wa-broadcast-cron', '* * * * *',
    format($f$ SELECT net.http_post(url:=%L, headers:=%L::jsonb, body:='{}'::jsonb); $f$,
      base || '/wa-broadcast-dispatch',
      json_build_object('Content-Type','application/json','apikey',anon_key)::text));

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'zernio-metrics-sync') THEN PERFORM cron.unschedule('zernio-metrics-sync'); END IF;
  PERFORM cron.schedule('zernio-metrics-sync', '*/30 * * * *',
    format($f$ SELECT net.http_post(url:=%L, headers:=%L::jsonb, body:='{}'::jsonb); $f$,
      base || '/zernio-metrics-sync',
      json_build_object('Content-Type','application/json','apikey',anon_key)::text));
END $$;