CREATE TABLE public.wa_campaign_lead_jobs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 campaign_id uuid NOT NULL REFERENCES public.campaigns(id),
 phone text NOT NULL,
 inbox_id uuid NOT NULL REFERENCES public.whatsapp_inbox(id),
 form_id uuid NOT NULL REFERENCES public.smartops_forms(id),
 lead_id uuid,
 status text NOT NULL DEFAULT 'processing',
 claim_token uuid NOT NULL DEFAULT gen_random_uuid(),
 attempts integer NOT NULL DEFAULT 1,
 last_error text,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (campaign_id,phone)
);
GRANT SELECT ON public.wa_campaign_lead_jobs TO authenticated;
GRANT ALL ON public.wa_campaign_lead_jobs TO service_role;
ALTER TABLE public.wa_campaign_lead_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY wa_campaign_lead_jobs_admin_read ON public.wa_campaign_lead_jobs FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'::public.app_role));
CREATE FUNCTION public.fn_wa_campaign_job_touch() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
CREATE TRIGGER wa_campaign_job_touch BEFORE UPDATE ON public.wa_campaign_lead_jobs FOR EACH ROW EXECUTE FUNCTION public.fn_wa_campaign_job_touch();
REVOKE ALL ON FUNCTION public.fn_wa_campaign_job_touch() FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.fn_claim_wa_campaign_lead(p_campaign_id uuid,p_phone text,p_inbox_id uuid,p_form_id uuid) RETURNS SETOF public.wa_campaign_lead_jobs LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 IF p_phone IS NULL OR p_phone !~ '^\+[0-9]{8,15}$' THEN RAISE EXCEPTION 'invalid phone'; END IF;
 RETURN QUERY INSERT INTO public.wa_campaign_lead_jobs AS j (campaign_id,phone,inbox_id,form_id)
 VALUES(p_campaign_id,p_phone,p_inbox_id,p_form_id)
 ON CONFLICT(campaign_id,phone) DO UPDATE SET
 status='processing',claim_token=gen_random_uuid(),attempts=j.attempts+1,last_error=NULL
 WHERE j.status='failed' OR (j.status='processing' AND j.updated_at<now()-interval '5 minutes')
 RETURNING j.*;
END $$;
REVOKE ALL ON FUNCTION public.fn_claim_wa_campaign_lead(uuid,text,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fn_claim_wa_campaign_lead(uuid,text,uuid,uuid) TO service_role;