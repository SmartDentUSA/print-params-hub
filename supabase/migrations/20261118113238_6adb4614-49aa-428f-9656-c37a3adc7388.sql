CREATE TABLE public.wa_official_sair_leads (
  lead_id uuid PRIMARY KEY REFERENCES public.lia_attendances(id) ON DELETE CASCADE,
  first_reply_at timestamptz NOT NULL DEFAULT now(),
  last_reply_at timestamptz NOT NULL DEFAULT now(),
  replies integer NOT NULL DEFAULT 1
);
GRANT SELECT ON public.wa_official_sair_leads TO authenticated;
GRANT ALL ON public.wa_official_sair_leads TO service_role;
ALTER TABLE public.wa_official_sair_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read sair leads" ON public.wa_official_sair_leads
  FOR SELECT TO authenticated USING (public.is_admin((SELECT auth.uid())));

CREATE OR REPLACE FUNCTION public.fn_log_wa_official_sair()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_lead uuid;
  v_digits text;
  v_rows int;
  v_at timestamptz;
BEGIN
  IF NEW.direction IS DISTINCT FROM 'inbound'
     OR coalesce(NEW.instance_name, '') NOT LIKE 'zernio:%'
     OR coalesce(NEW.is_group, false)
     OR lower(regexp_replace(coalesce(NEW.message_text, ''), '[^[:alpha:]]', '', 'g')) <> 'sair' THEN
    RETURN NEW;
  END IF;

  v_lead := NEW.lead_id;
  IF v_lead IS NULL THEN
    v_digits := regexp_replace(coalesce(NEW.phone_normalized, NEW.phone, ''), '\D', '', 'g');
    IF v_digits <> '' THEN
      SELECT id INTO v_lead FROM public.lia_attendances
       WHERE merged_into IS NULL AND telefone_normalized = '+' || v_digits
       ORDER BY updated_at DESC NULLS LAST LIMIT 1;
    END IF;
  ELSE
    SELECT coalesce(merged_into, id) INTO v_lead FROM public.lia_attendances WHERE id = v_lead;
  END IF;
  IF v_lead IS NULL THEN
    RETURN NEW;
  END IF;

  v_at := coalesce(NEW.created_at, now());

  INSERT INTO public.lead_activity_log
    (lead_id, event_type, event_timestamp, event_data, entity_type, entity_id, entity_name, source_channel, dedupe_hash)
  VALUES
    (v_lead, 'whatsapp_oficial_sair', v_at,
     jsonb_build_object(
       'kind_label', 'Respondeu SAIR (WhatsApp Oficial)',
       'mensagem', NEW.message_text,
       'telefone', NEW.phone,
       'conta', NEW.instance_name,
       'wa_message_id', NEW.wa_message_id,
       'inbox_id', NEW.id,
       'remove_da_lista', false
     ),
     'whatsapp_inbox', NEW.id::text, 'Respondeu SAIR (WhatsApp Oficial)', 'whatsapp_oficial',
     'wa_inbox:' || NEW.id::text)
  ON CONFLICT (lead_id, event_type, dedupe_hash) WHERE dedupe_hash IS NOT NULL DO NOTHING;
  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows > 0 THEN
    INSERT INTO public.wa_official_sair_leads (lead_id, first_reply_at, last_reply_at, replies)
    VALUES (v_lead, v_at, v_at, 1)
    ON CONFLICT (lead_id) DO UPDATE
      SET last_reply_at = greatest(wa_official_sair_leads.last_reply_at, EXCLUDED.last_reply_at),
          first_reply_at = least(wa_official_sair_leads.first_reply_at, EXCLUDED.first_reply_at),
          replies = wa_official_sair_leads.replies + 1;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'fn_log_wa_official_sair: %', SQLERRM;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_log_wa_official_sair() FROM PUBLIC, anon, authenticated;

INSERT INTO public.wa_official_sair_leads (lead_id, first_reply_at, last_reply_at, replies)
SELECT coalesce(a.merged_into, a.id), min(l.event_timestamp), max(l.event_timestamp), count(*)
  FROM public.lead_activity_log l JOIN public.lia_attendances a ON a.id = l.lead_id
 WHERE l.event_type = 'whatsapp_oficial_sair'
 GROUP BY 1
ON CONFLICT (lead_id) DO NOTHING;