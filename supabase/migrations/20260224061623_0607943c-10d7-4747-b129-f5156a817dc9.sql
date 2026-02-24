-- Create a database trigger to auto-invoke evaluate-interaction via pg_net
-- when agent_response is filled on agent_interactions

-- Enable pg_net if not already
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Function that calls the edge function via HTTP
CREATE OR REPLACE FUNCTION public.trigger_evaluate_interaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _supabase_url text := current_setting('app.settings.supabase_url', true);
  _service_key text := current_setting('app.settings.service_role_key', true);
BEGIN
  -- Only fire when agent_response transitions from NULL to a value
  IF NEW.agent_response IS NOT NULL 
     AND (OLD.agent_response IS NULL)
     AND NEW.judge_evaluated_at IS NULL
     AND NEW.unanswered IS NOT TRUE
     AND length(NEW.user_message) >= 10
  THEN
    PERFORM extensions.http_post(
      url := 'https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/evaluate-interaction',
      body := jsonb_build_object(
        'record', row_to_json(NEW),
        'old_record', row_to_json(OLD)
      ),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rZW9namdxaWpiZmt1ZGZqYWR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4NzE5MDgsImV4cCI6MjA3MjQ0NzkwOH0.OGdtvsJNdEqAfUoDA4O9OcnD69Titu69TsXS38TaVtk'
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Create the trigger on UPDATE of agent_interactions
DROP TRIGGER IF EXISTS trg_evaluate_interaction ON public.agent_interactions;
CREATE TRIGGER trg_evaluate_interaction
  AFTER UPDATE OF agent_response ON public.agent_interactions
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_evaluate_interaction();
