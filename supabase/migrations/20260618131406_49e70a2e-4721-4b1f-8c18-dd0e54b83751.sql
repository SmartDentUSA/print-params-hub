ALTER TABLE public.social_scheduled_posts REPLICA IDENTITY FULL;
DO $$ BEGIN
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.social_scheduled_posts';
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.social_posts';
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
ALTER TABLE public.social_posts REPLICA IDENTITY FULL;