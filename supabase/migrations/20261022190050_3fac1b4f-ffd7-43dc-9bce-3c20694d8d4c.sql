CREATE OR REPLACE FUNCTION public.fn_claim_video_analytics_sync(p_scheduled boolean DEFAULT false) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE claimed text;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 INSERT INTO public.cron_state(key,value,meta,updated_at) VALUES ('panda_analytics_sync','running',jsonb_build_object('locked_until',now()+interval '5 minutes','last_scheduled_at',CASE WHEN p_scheduled THEN now() ELSE NULL END),now())
 ON CONFLICT(key) DO UPDATE SET value='running',meta=cron_state.meta || jsonb_build_object('locked_until',now()+interval '5 minutes','last_scheduled_at',CASE WHEN p_scheduled THEN to_jsonb(now()) ELSE cron_state.meta->'last_scheduled_at' END),updated_at=now()
 WHERE coalesce((cron_state.meta->>'locked_until')::timestamptz,'epoch'::timestamptz) <= now()
 AND (NOT p_scheduled OR coalesce((cron_state.meta->>'last_scheduled_at')::timestamptz,'epoch'::timestamptz) <= now()-interval '55 minutes')
 RETURNING key INTO claimed;
 RETURN claimed IS NOT NULL;
END $$;
REVOKE ALL ON FUNCTION public.fn_claim_video_analytics_sync(boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fn_claim_video_analytics_sync(boolean) TO service_role;
CREATE OR REPLACE FUNCTION public.fn_finish_video_analytics_sync(p_cursor integer DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 UPDATE public.cron_state SET value='idle',meta=meta || jsonb_build_object('locked_until',now()) || CASE WHEN p_cursor IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('cursor',greatest(p_cursor,0)) END,updated_at=now() WHERE key='panda_analytics_sync';
END $$;
REVOKE ALL ON FUNCTION public.fn_finish_video_analytics_sync(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fn_finish_video_analytics_sync(integer) TO service_role;