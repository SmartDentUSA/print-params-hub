CREATE INDEX wa_campaign_lead_jobs_form_idx ON public.wa_campaign_lead_jobs(form_id);
CREATE INDEX wa_campaign_lead_jobs_inbox_idx ON public.wa_campaign_lead_jobs(inbox_id);
ALTER TABLE public.wa_campaign_lead_jobs ADD COLUMN account_id text, ADD COLUMN conversation_id text, ADD COLUMN categories jsonb NOT NULL DEFAULT '[]', ADD COLUMN context jsonb NOT NULL DEFAULT '{}', ADD COLUMN selected_category jsonb, ADD COLUMN selection_inbox_id uuid, ADD COLUMN menu_sent_at timestamptz, ADD COLUMN menu_message_id text, ADD COLUMN note_status text;
CREATE INDEX wa_campaign_lead_jobs_waiting_idx ON public.wa_campaign_lead_jobs(phone,account_id,created_at DESC);
CREATE OR REPLACE FUNCTION public.fn_claim_wa_campaign_lead(p_campaign_id uuid,p_phone text,p_inbox_id uuid,p_form_id uuid) RETURNS SETOF public.wa_campaign_lead_jobs LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 IF p_phone IS NULL OR p_phone !~ '^\+[0-9]{8,15}$' THEN RAISE EXCEPTION 'invalid phone'; END IF;
 RETURN QUERY INSERT INTO public.wa_campaign_lead_jobs AS j (campaign_id,phone,inbox_id,form_id,status) VALUES(p_campaign_id,p_phone,p_inbox_id,p_form_id,'menu_sending')
 ON CONFLICT(campaign_id,phone) DO UPDATE SET status=CASE WHEN j.selected_category IS NULL THEN 'menu_sending' ELSE 'processing' END,claim_token=gen_random_uuid(),attempts=j.attempts+1,last_error=NULL
 WHERE j.status='failed' OR (j.status IN ('menu_sending','processing') AND j.updated_at<now()-interval '5 minutes') RETURNING j.*;
END $$;
CREATE FUNCTION public.fn_claim_wa_category(p_job_id uuid,p_inbox_id uuid,p_category_index integer) RETURNS SETOF public.wa_campaign_lead_jobs LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 RETURN QUERY UPDATE public.wa_campaign_lead_jobs j SET status='processing',selected_category=j.categories->p_category_index,selection_inbox_id=p_inbox_id,claim_token=gen_random_uuid(),attempts=j.attempts+1
 WHERE j.id=p_job_id AND j.status IN ('awaiting_category','waiting_window','failed') AND j.menu_sent_at IS NOT NULL AND p_category_index>=0 AND p_category_index<jsonb_array_length(j.categories)
 AND EXISTS (SELECT 1 FROM public.whatsapp_inbox w WHERE w.id=p_inbox_id AND w.direction='inbound' AND w.instance_name='zernio:'||j.account_id AND w.created_at>=j.menu_sent_at)
 RETURNING j.*;
END $$;
REVOKE ALL ON FUNCTION public.fn_claim_wa_category(uuid,uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fn_claim_wa_category(uuid,uuid,integer) TO service_role;
CREATE TABLE public.wa_campaign_reply_dispatch (
 inbox_id uuid PRIMARY KEY REFERENCES public.whatsapp_inbox(id), dispatch_token uuid NOT NULL DEFAULT gen_random_uuid(), status text NOT NULL DEFAULT 'pending', last_error text,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.wa_campaign_reply_dispatch TO authenticated;
GRANT ALL ON public.wa_campaign_reply_dispatch TO service_role;
ALTER TABLE public.wa_campaign_reply_dispatch ENABLE ROW LEVEL SECURITY;
CREATE POLICY wa_campaign_dispatch_admin_read ON public.wa_campaign_reply_dispatch FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'admin'::public.app_role));
CREATE TRIGGER wa_campaign_dispatch_touch BEFORE UPDATE ON public.wa_campaign_reply_dispatch FOR EACH ROW EXECUTE FUNCTION public.fn_wa_campaign_job_touch();
CREATE FUNCTION public.fn_dispatch_wa_campaign_reply() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 PERFORM net.http_post(url:='https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/wa-campaign-lead', headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rZW9namdxaWpiZmt1ZGZqYWR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4NzE5MDgsImV4cCI6MjA3MjQ0NzkwOH0.OGdtvsJNdEqAfUoDA4O9OcnD69Titu69TsXS38TaVtk'),body:=jsonb_build_object('inbox_id',NEW.inbox_id,'dispatch_token',NEW.dispatch_token,'dry_run',false),timeout_milliseconds:=120000);
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.fn_dispatch_wa_campaign_reply() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER wa_campaign_reply_dispatch_send AFTER INSERT ON public.wa_campaign_reply_dispatch FOR EACH ROW EXECUTE FUNCTION public.fn_dispatch_wa_campaign_reply();