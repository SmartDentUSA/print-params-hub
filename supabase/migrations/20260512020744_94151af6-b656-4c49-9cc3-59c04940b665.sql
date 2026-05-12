-- Fix fn_trigger_sdr_voice_on_assign: bad reference to vault.secrets.value
-- (column is `secret`, not `value`) caused 42703 "column \"value\" does not exist"
-- which aborted the entire UPDATE in lia_attendances and left leads without
-- piperun_id / pessoa_piperun_id / funil / etapa.

CREATE OR REPLACE FUNCTION public.fn_trigger_sdr_voice_on_assign()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_seller_id TEXT;
  v_url       TEXT;
  v_key       TEXT;
BEGIN
  -- Same trigger conditions as before
  IF (OLD.proprietario_lead_crm IS NULL OR OLD.proprietario_lead_crm = '')
     AND NEW.proprietario_lead_crm IS NOT NULL
     AND (NEW.produto_interesse IS NOT NULL OR NEW.anchor_product IS NOT NULL)
     AND NEW.telefone_normalized IS NOT NULL
     AND NEW.proactive_sent_at IS NULL
     AND NEW.created_at > (NOW() - INTERVAL '60 minutes')
  THEN
    BEGIN
      SELECT id INTO v_seller_id
      FROM public.team_members
      WHERE nome_completo ILIKE '%' || split_part(NEW.proprietario_lead_crm, ' ', 1) || '%'
        AND ativo = true
        AND waleads_api_key IS NOT NULL
      LIMIT 1;

      IF v_seller_id IS NOT NULL THEN
        v_url := current_setting('app.supabase_url', true);
        v_key := current_setting('app.service_role_key', true);

        -- Only attempt the HTTP call if both runtime settings are configured.
        -- We DO NOT read from vault.secrets here — that path used a non-existent
        -- column and crashed the UPDATE. If settings are missing, just skip.
        IF v_url IS NOT NULL AND v_url <> '' AND v_key IS NOT NULL AND v_key <> '' THEN
          PERFORM net.http_post(
            url      := v_url || '/functions/v1/send-sdr-voice',
            body     := jsonb_build_object(
                          'lead_id',      NEW.id::text,
                          'seller_tm_id', v_seller_id,
                          'dry_run',      false
                        ),
            headers  := jsonb_build_object(
                          'Content-Type',  'application/json',
                          'Authorization', 'Bearer ' || v_key
                        ),
            timeout_milliseconds := 5000
          );
          RAISE LOG '[sdr-voice-trigger] Fired for lead % seller %', NEW.id, v_seller_id;
        ELSE
          RAISE LOG '[sdr-voice-trigger] Skipped (settings missing) for lead %', NEW.id;
        END IF;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- NEVER let this trigger abort the lead update. Just log and continue.
      RAISE LOG '[sdr-voice-trigger] Suppressed error for lead %: % %', NEW.id, SQLSTATE, SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$function$;