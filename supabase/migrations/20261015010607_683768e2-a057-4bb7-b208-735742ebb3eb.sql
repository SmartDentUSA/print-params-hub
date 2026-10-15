CREATE OR REPLACE FUNCTION public.fn_trg_kol_course_publish_reels()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'publicado'
     AND (OLD.status IS DISTINCT FROM 'publicado')
     AND NEW.reels_storage_path IS NOT NULL
     AND COALESCE(NEW.reels_social_status, '') IN ('awaiting_course_publish', 'error', '')
     AND NEW.reels_social_post_id IS NULL
  THEN
    PERFORM net.http_post(
      url := 'https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/kol-course-reels-publish',
      headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rZW9namdxaWpiZmt1ZGZqYWR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4NzE5MDgsImV4cCI6MjA3MjQ0NzkwOH0.OGdtvsJNdEqAfUoDA4O9OcnD69Titu69TsXS38TaVtk"}'::jsonb,
      body := jsonb_build_object('course_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_kol_course_publish_reels ON public.professional_courses;
CREATE TRIGGER trg_kol_course_publish_reels
  AFTER UPDATE ON public.professional_courses
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_trg_kol_course_publish_reels();

REVOKE EXECUTE ON FUNCTION public.fn_trg_kol_course_publish_reels() FROM anon, public;