DROP TRIGGER IF EXISTS trg_kol_course_publish_reels ON public.professional_courses;
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT tgname FROM pg_trigger WHERE tgrelid='public.professional_courses'::regclass AND NOT tgisinternal
    AND tgfoid='public.fn_trg_kol_course_publish_reels()'::regprocedure LOOP
    EXECUTE format('DROP TRIGGER %I ON public.professional_courses', r.tgname);
  END LOOP;
END $$;
DROP FUNCTION IF EXISTS public.fn_trg_kol_course_publish_reels();