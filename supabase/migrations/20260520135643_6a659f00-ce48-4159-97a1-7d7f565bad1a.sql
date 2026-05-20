ALTER TABLE public.smartops_courses REPLICA IDENTITY FULL;
ALTER TABLE public.smartops_course_turmas REPLICA IDENTITY FULL;
ALTER TABLE public.smartops_turma_days REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='smartops_courses') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.smartops_courses';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='smartops_course_turmas') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.smartops_course_turmas';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='smartops_turma_days') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.smartops_turma_days';
  END IF;
END $$;