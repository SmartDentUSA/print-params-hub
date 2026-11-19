ALTER TABLE public.smartops_forms DROP CONSTRAINT smartops_forms_form_purpose_check;
ALTER TABLE public.smartops_forms ADD CONSTRAINT smartops_forms_form_purpose_check CHECK (form_purpose = ANY (ARRAY['nps','sdr','roi','cs','captacao','evento','sdr_captacao','cm_update_deal','cs_update_deals','st_update_deals','feira_evento','credenciamento','distribuicao','insercao_crm','kol_expansao','oportunidade_evento']));

CREATE TABLE public.field_capture_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id uuid NOT NULL,
  sender_phone text NOT NULL,
  account_id text NOT NULL,
  conversation_id text,
  event_id uuid,
  capture_type text CHECK (capture_type IN ('lead','kol','oportunidade')),
  status text NOT NULL DEFAULT 'collecting' CHECK (status IN ('collecting','processing','done','error','cancelled')),
  extracted jsonb,
  summary text,
  opportunity_name text,
  drive_folder_id text,
  drive_folder_url text,
  lead_id uuid,
  result jsonb,
  error text,
  reminded_at timestamptz,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.field_capture_sessions TO authenticated;
GRANT ALL ON public.field_capture_sessions TO service_role;
ALTER TABLE public.field_capture_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read field capture sessions" ON public.field_capture_sessions FOR SELECT TO authenticated USING (public.fn_is_internal_staff(auth.uid()));
CREATE UNIQUE INDEX field_capture_one_open ON public.field_capture_sessions (team_member_id) WHERE status = 'collecting';
CREATE INDEX field_capture_sessions_event ON public.field_capture_sessions (event_id, created_at DESC);

CREATE TABLE public.field_capture_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.field_capture_sessions(id) ON DELETE CASCADE,
  inbox_id uuid,
  wa_message_id text NOT NULL UNIQUE,
  kind text NOT NULL,
  mime_type text,
  text_content text,
  drive_file_id text,
  drive_file_url text,
  transcript text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.field_capture_items TO authenticated;
GRANT ALL ON public.field_capture_items TO service_role;
ALTER TABLE public.field_capture_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read field capture items" ON public.field_capture_items FOR SELECT TO authenticated USING (public.fn_is_internal_staff(auth.uid()));
CREATE INDEX field_capture_items_session ON public.field_capture_items (session_id, created_at);

CREATE TRIGGER trg_field_capture_sessions_updated BEFORE UPDATE ON public.field_capture_sessions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Celular de membro ativo da equipe (DDD + últimos 8 dígitos, com/sem 55 e 9º dígito)
CREATE OR REPLACE FUNCTION public.fn_team_member_by_phone(p_phone text)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH k AS (SELECT regexp_replace(coalesce(p_phone,''), '\D', '', 'g') d),
  kk AS (SELECT CASE WHEN length(d) >= 12 AND d LIKE '55%' THEN substr(d,3) ELSE d END d FROM k)
  SELECT t.id FROM team_members t, kk
  WHERE t.ativo IS TRUE AND length(kk.d) >= 10 AND EXISTS (
    SELECT 1 FROM unnest(ARRAY[t.whatsapp_number, t.evolution_phone, t.notification_phone]) p(v)
    CROSS JOIN LATERAL (SELECT regexp_replace(coalesce(p.v,''), '\D', '', 'g') s) x
    CROSS JOIN LATERAL (SELECT CASE WHEN length(x.s) >= 12 AND x.s LIKE '55%' THEN substr(x.s,3) ELSE x.s END s) y
    WHERE length(y.s) >= 10 AND right(y.s, 8) = right(kk.d, 8) AND left(y.s, 2) = left(kk.d, 2))
  ORDER BY t.id LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.fn_team_member_by_phone(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_team_member_by_phone(text) TO service_role;

CREATE OR REPLACE FUNCTION public.fn_dispatch_field_capture()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.direction IS DISTINCT FROM 'inbound'
     OR coalesce(NEW.instance_name, '') NOT LIKE 'zernio:%'
     OR coalesce(NEW.is_group, false)
     OR nullif(btrim(coalesce(NEW.raw_payload->'metadata'->>'buttonPayload', '')), '') IS NOT NULL
     OR public.fn_team_member_by_phone(NEW.phone) IS NULL THEN
    RETURN NEW;
  END IF;
  PERFORM net.http_post(
    url := 'https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/wa-field-capture',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('inbox_id', NEW.id)
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END $$;
CREATE TRIGGER trg_dispatch_field_capture AFTER INSERT ON public.whatsapp_inbox
FOR EACH ROW EXECUTE FUNCTION public.fn_dispatch_field_capture();