CREATE OR REPLACE FUNCTION public.fn_notify_treinamento_agendado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.status = 'agendado'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'agendado')
     AND NEW.wa_sent_at IS NULL
     AND NEW.lead_id IS NOT NULL
  THEN
    BEGIN
      PERFORM net.http_post(
        url     := 'https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/cs-treinamento-agendado',
        body    := jsonb_build_object('enrollment_id', NEW.id),
        headers := '{"Content-Type":"application/json"}'::jsonb
      );
    EXCEPTION WHEN OTHERS THEN
      BEGIN
        INSERT INTO public.system_health_logs(error_type, error_message, context)
        VALUES (
          'enrollment_notify_failed',
          SQLERRM,
          jsonb_build_object('enrollment_id', NEW.id, 'sqlstate', SQLSTATE)
        );
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END;
  END IF;
  RETURN NEW;
END;
$$;