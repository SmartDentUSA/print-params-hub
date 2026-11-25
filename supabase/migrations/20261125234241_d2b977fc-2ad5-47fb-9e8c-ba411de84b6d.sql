CREATE OR REPLACE FUNCTION public.fn_claim_wa_category(p_job_id uuid,p_inbox_id uuid,p_category_index integer) RETURNS SETOF public.wa_campaign_lead_jobs LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 RETURN QUERY UPDATE public.wa_campaign_lead_jobs j SET status='processing',selected_category=j.categories->p_category_index,selection_inbox_id=p_inbox_id,claim_token=gen_random_uuid(),attempts=j.attempts+1
 WHERE j.id=p_job_id AND (j.status IN ('awaiting_category','waiting_window','failed') OR (j.status='processing' AND j.updated_at<now()-interval '5 minutes'))
 AND j.menu_sent_at IS NOT NULL AND p_category_index>=0 AND p_category_index<jsonb_array_length(j.categories)
 AND EXISTS(SELECT 1 FROM public.whatsapp_inbox w WHERE w.id=p_inbox_id AND w.direction='inbound' AND w.instance_name='zernio:'||j.account_id AND w.created_at>=j.menu_sent_at)
 RETURNING j.*;
END $$;
REVOKE ALL ON FUNCTION public.fn_claim_wa_category(uuid,uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fn_claim_wa_category(uuid,uuid,integer) TO service_role;