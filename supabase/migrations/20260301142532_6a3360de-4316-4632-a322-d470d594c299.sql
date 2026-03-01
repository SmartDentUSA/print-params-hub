
-- ═══════════════════════════════════════════════════════════════════
-- FIX 1: Rebuild Judge IA trigger using pg_net (more reliable than http extension)
-- ═══════════════════════════════════════════════════════════════════

-- Drop old trigger
DROP TRIGGER IF EXISTS trg_evaluate_interaction ON public.agent_interactions;
DROP FUNCTION IF EXISTS public.trigger_evaluate_interaction();

-- Recreate trigger function using net.http_post (pg_net)
CREATE OR REPLACE FUNCTION public.trigger_evaluate_interaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.agent_response IS NOT NULL 
     AND (OLD.agent_response IS NULL)
     AND NEW.judge_evaluated_at IS NULL
     AND NEW.unanswered IS NOT TRUE
     AND length(NEW.user_message) >= 10
  THEN
    PERFORM net.http_post(
      url := 'https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/evaluate-interaction',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rZW9namdxaWpiZmt1ZGZqYWR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4NzE5MDgsImV4cCI6MjA3MjQ0NzkwOH0.OGdtvsJNdEqAfUoDA4O9OcnD69Titu69TsXS38TaVtk'
      ),
      body := jsonb_build_object(
        'record', row_to_json(NEW),
        'old_record', row_to_json(OLD)
      )
    );
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_evaluate_interaction
  AFTER UPDATE ON public.agent_interactions
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_evaluate_interaction();
