CREATE TABLE public.wa_button_reply_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid,
  session_id uuid,
  account_id text NOT NULL,
  broadcast_ids text[] NOT NULL DEFAULT '{}',
  test_phones text[] NOT NULL DEFAULT '{}',
  is_test boolean NOT NULL DEFAULT false,
  buttons jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days')
);
GRANT SELECT ON public.wa_button_reply_rules TO authenticated;
GRANT ALL ON public.wa_button_reply_rules TO service_role;
ALTER TABLE public.wa_button_reply_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read button reply rules" ON public.wa_button_reply_rules
  FOR SELECT TO authenticated USING (public.fn_is_internal_staff(auth.uid()));
CREATE INDEX wa_button_reply_rules_bids ON public.wa_button_reply_rules USING gin (broadcast_ids);
CREATE INDEX wa_button_reply_rules_account ON public.wa_button_reply_rules (account_id, created_at DESC);

CREATE TABLE public.wa_button_reply_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inbox_id uuid NOT NULL UNIQUE,
  rule_id uuid,
  campaign_id uuid,
  lead_id uuid,
  phone text NOT NULL,
  button_key text NOT NULL,
  button_label text,
  link text,
  reply_text text,
  status text NOT NULL DEFAULT 'sending',
  skip_reason text,
  provider_message_id text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);
GRANT SELECT ON public.wa_button_reply_log TO authenticated;
GRANT ALL ON public.wa_button_reply_log TO service_role;
ALTER TABLE public.wa_button_reply_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read button reply log" ON public.wa_button_reply_log
  FOR SELECT TO authenticated USING (public.fn_is_internal_staff(auth.uid()));
CREATE INDEX wa_button_reply_log_phone ON public.wa_button_reply_log (phone, button_key, created_at DESC);

CREATE OR REPLACE FUNCTION public.fn_dispatch_wa_button_reply()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_key text;
BEGIN
  IF NEW.direction IS DISTINCT FROM 'inbound'
     OR coalesce(NEW.instance_name, '') NOT LIKE 'zernio:%'
     OR nullif(btrim(coalesce(NEW.raw_payload->'metadata'->>'buttonPayload', '')), '') IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1;
  PERFORM net.http_post(
    url := 'https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/zernio-wa-button-reply',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || coalesce(v_key, '')),
    body := jsonb_build_object('inbox_id', NEW.id)
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'fn_dispatch_wa_button_reply: %', SQLERRM;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.fn_dispatch_wa_button_reply() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_dispatch_wa_button_reply AFTER INSERT ON public.whatsapp_inbox
  FOR EACH ROW EXECUTE FUNCTION public.fn_dispatch_wa_button_reply();

CREATE OR REPLACE FUNCTION public.fn_attendance_channel_metrics(_form_id uuid DEFAULT NULL::uuid, _campaign_slug text DEFAULT NULL::text, _since timestamp with time zone DEFAULT (now() - '90 days'::interval))
 RETURNS TABLE(channel text, views bigint, leads bigint, conversions bigint, revenue numeric)
 LANGUAGE sql STABLE SET search_path TO 'public'
AS $function$
  WITH ev AS (
    SELECT * FROM attendance_channel_events e
    WHERE e.created_at >= _since
      AND (_form_id IS NULL OR e.form_id = _form_id)
      AND (_campaign_slug IS NULL OR lower(e.campaign_slug) = lower(_campaign_slug))
  ),
  ch AS (SELECT unnest(ARRAY['form','specialist','whatsapp_lia','whatsapp_api']) AS channel),
  lead_first AS (
    SELECT ev.channel, ev.lead_id, min(ev.created_at) AS at FROM ev
    WHERE ev.event_type = 'lead' AND ev.lead_id IS NOT NULL GROUP BY 1,2
  ),
  won AS (
    SELECT lf.channel, lf.lead_id, sum(d.value) AS v FROM lead_first lf
    JOIN deals d ON d.lead_id = lf.lead_id AND d.status = 'ganha'
     AND coalesce(d.closed_at, d.piperun_created_at, d.created_at) > lf.at
    GROUP BY 1,2
  )
  SELECT ch.channel,
    (SELECT count(*) FROM ev WHERE ev.channel = ch.channel AND ev.event_type IN ('view','click','open')),
    (SELECT count(*) FROM lead_first lf WHERE lf.channel = ch.channel),
    (SELECT count(*) FROM won w WHERE w.channel = ch.channel),
    coalesce((SELECT sum(w.v) FROM won w WHERE w.channel = ch.channel), 0)
  FROM ch
  WHERE auth.uid() IS NOT NULL;
$function$;