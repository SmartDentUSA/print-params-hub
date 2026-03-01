
-- Cron: stagnant-processor a cada 6 horas
SELECT cron.schedule(
  'stagnant-processor-cron',
  '0 */6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/smart-ops-stagnant-processor',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rZW9namdxaWpiZmt1ZGZqYWR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4NzE5MDgsImV4cCI6MjA3MjQ0NzkwOH0.OGdtvsJNdEqAfUoDA4O9OcnD69Titu69TsXS38TaVtk"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- Cron: proactive-outreach seg-sex 10h BRT (13h UTC)
SELECT cron.schedule(
  'proactive-outreach-cron',
  '0 13 * * 1-5',
  $$
  SELECT net.http_post(
    url := 'https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/smart-ops-proactive-outreach',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rZW9namdxaWpiZmt1ZGZqYWR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4NzE5MDgsImV4cCI6MjA3MjQ0NzkwOH0.OGdtvsJNdEqAfUoDA4O9OcnD69Titu69TsXS38TaVtk"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- Cron: backfill judge evaluations (cada 2 min, processar 5 pendentes por vez)
SELECT cron.schedule(
  'backfill-judge-evaluations',
  '*/2 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/evaluate-interaction',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rZW9namdxaWpiZmt1ZGZqYWR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4NzE5MDgsImV4cCI6MjA3MjQ0NzkwOH0.OGdtvsJNdEqAfUoDA4O9OcnD69Titu69TsXS38TaVtk"}'::jsonb,
    body := jsonb_build_object(
      'record', jsonb_build_object(
        'id', p.id,
        'user_message', p.user_message,
        'agent_response', p.agent_response,
        'context_raw', p.context_raw,
        'unanswered', p.unanswered
      ),
      'old_record', jsonb_build_object('agent_response', null)
    )
  ) AS request_id
  FROM (
    SELECT id, user_message, agent_response, context_raw, unanswered
    FROM public.agent_interactions
    WHERE agent_response IS NOT NULL
      AND judge_evaluated_at IS NULL
      AND unanswered IS NOT TRUE
      AND length(user_message) >= 10
    ORDER BY created_at ASC
    LIMIT 5
  ) p;
  $$
);
