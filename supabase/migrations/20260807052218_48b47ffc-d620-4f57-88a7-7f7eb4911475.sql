ALTER TABLE public.campaign_send_log RENAME COLUMN waleads_message_id TO wa_message_id;

ALTER TABLE public.cs_automation_rules RENAME COLUMN waleads_ativo TO wa_ativo;
ALTER TABLE public.cs_automation_rules RENAME COLUMN waleads_tipo TO wa_tipo;
ALTER TABLE public.cs_automation_rules RENAME COLUMN mensagem_waleads TO mensagem_wa;
ALTER TABLE public.cs_automation_rules RENAME COLUMN waleads_media_url TO wa_media_url;
ALTER TABLE public.cs_automation_rules RENAME COLUMN waleads_media_caption TO wa_media_caption;

ALTER TABLE public.ltv_reactivation_rules RENAME COLUMN waleads_message TO wa_message;

ALTER TABLE public.lia_attendances RENAME COLUMN last_waleads_instance TO last_wa_instance;
ALTER VIEW public.v_reactivation_candidates RENAME COLUMN last_waleads_instance TO last_wa_instance;
ALTER VIEW public.vw_lia_attendances_enriched RENAME COLUMN last_waleads_instance TO last_wa_instance;

ALTER TABLE public.team_members DROP COLUMN IF EXISTS waleads_api_key;
ALTER TABLE public.team_members DROP COLUMN IF EXISTS waleads_instance_name;
ALTER TABLE public.team_members DROP COLUMN IF EXISTS waleads_phone_number;

CREATE OR REPLACE FUNCTION public.fn_enqueue_whatsapp(p_to_phone text, p_message_text text, p_provider text DEFAULT 'evolution'::text, p_evolution_inst text DEFAULT NULL::text, p_team_member_id uuid DEFAULT NULL::uuid, p_lead_id uuid DEFAULT NULL::uuid, p_message_type text DEFAULT 'text'::text, p_media_url text DEFAULT NULL::text, p_media_caption text DEFAULT NULL::text, p_media_filename text DEFAULT NULL::text, p_priority integer DEFAULT 5, p_trigger_source text DEFAULT 'manual'::text, p_automation_id uuid DEFAULT NULL::uuid, p_scheduled_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS uuid
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_id       uuid;
  v_delay_ms integer;
  v_count    integer;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM whatsapp_send_queue
  WHERE status IN ('pending','processing','sent')
    AND created_at > now() - interval '60 seconds'
    AND provider = p_provider
    AND (p_evolution_inst IS NULL OR evolution_instance = p_evolution_inst);

  v_delay_ms := 1500 + floor(random() * 2000)::int + (v_count * 500);

  INSERT INTO whatsapp_send_queue (
    to_phone, message_text, provider, evolution_instance,
    team_member_id, lead_id, message_type,
    media_url, media_caption, media_filename,
    priority, delay_ms, trigger_source, automation_rule_id,
    scheduled_at
  ) VALUES (
    p_to_phone, p_message_text, p_provider, p_evolution_inst,
    p_team_member_id, p_lead_id, p_message_type,
    p_media_url, p_media_caption, p_media_filename,
    p_priority, v_delay_ms, p_trigger_source, p_automation_id,
    COALESCE(p_scheduled_at, now())
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;