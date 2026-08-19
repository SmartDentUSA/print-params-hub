with k as (select substring(command from 'x-cron-key[^A-Za-z0-9]+([A-Za-z0-9_\-]{8,})') as key from cron.job where jobid=174)
select net.http_post(
  url:='https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/training-testimonial-social-publish',
  headers:=jsonb_build_object('Content-Type','application/json','x-cron-key',(select key from k)),
  body:='{"testimonial_id":"4eff8525-5d03-4f66-a6ba-4f48758e4438","dry_run":true,"force":true}'::jsonb,
  timeout_milliseconds:=120000
)