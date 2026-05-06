
DROP TABLE IF EXISTS public._backup_qid_migration_20260427 CASCADE;
DROP TABLE IF EXISTS public._backup_qid_migration_aux_20260427 CASCADE;
DROP TABLE IF EXISTS public._backup_category_f_20260427 CASCADE;

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'vitality_gen_control',
    'produto_aliases',
    'system_a_content_library',
    'google_indexing_log',
    'kg_entities',
    'kg_relations'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename=t) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('DROP POLICY IF EXISTS "service_role_full" ON public.%I', t);
      EXECUTE format('DROP POLICY IF EXISTS "admin_read" ON public.%I', t);
      EXECUTE format('CREATE POLICY "service_role_full" ON public.%I AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true)', t);
      EXECUTE format('CREATE POLICY "admin_read" ON public.%I AS PERMISSIVE FOR SELECT TO authenticated USING (public.is_admin(auth.uid()))', t);
    END IF;
  END LOOP;
END $$;

DO $$
DECLARE
  v record;
BEGIN
  FOR v IN SELECT table_name FROM information_schema.views WHERE table_schema='public'
  LOOP
    BEGIN
      EXECUTE format('ALTER VIEW public.%I SET (security_invoker = true)', v.table_name);
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'Skipped view %: %', v.table_name, SQLERRM;
    END;
  END LOOP;
END $$;
