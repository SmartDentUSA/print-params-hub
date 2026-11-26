CREATE TABLE public.wa_official_campaign_control (
 session_id uuid PRIMARY KEY REFERENCES public.campaign_sessions(id) ON DELETE CASCADE,
 state jsonb NOT NULL DEFAULT '{}'::jsonb,
 lock_token uuid,
 lock_until timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.wa_official_campaign_control TO service_role;
ALTER TABLE public.wa_official_campaign_control ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_only ON public.wa_official_campaign_control FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE FUNCTION public.fn_claim_wa_campaign_control(p_session uuid,p_token uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 INSERT INTO public.wa_official_campaign_control(session_id,lock_token,lock_until) VALUES(p_session,p_token,now()+interval '3 minutes')
 ON CONFLICT(session_id) DO UPDATE SET lock_token=EXCLUDED.lock_token,lock_until=EXCLUDED.lock_until,updated_at=now()
 WHERE wa_official_campaign_control.lock_until IS NULL OR wa_official_campaign_control.lock_until < now();
 RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION public.fn_claim_wa_campaign_control(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fn_claim_wa_campaign_control(uuid,uuid) TO service_role;
CREATE FUNCTION public.fn_touch_wa_campaign_control() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;
CREATE TRIGGER touch_wa_campaign_control BEFORE UPDATE ON public.wa_official_campaign_control FOR EACH ROW EXECUTE FUNCTION public.fn_touch_wa_campaign_control();