DO $$
BEGIN
  PERFORM cron.unschedule(141);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'cron job 141 not found';
END $$;

DROP TRIGGER IF EXISTS trg_social_post_to_wa ON public.social_posts;
DROP FUNCTION IF EXISTS public.fn_social_post_to_wa_campaign();