DO $$
DECLARE v_key text;
BEGIN
  SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1;
  PERFORM net.http_post(
    url := 'https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/zernio-wa-button-reply',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || coalesce(v_key, '')),
    body := jsonb_build_object('inbox_id', 'b6fc040c-6bf7-4e50-ba95-6a828b0064a5')
  );
END $$;