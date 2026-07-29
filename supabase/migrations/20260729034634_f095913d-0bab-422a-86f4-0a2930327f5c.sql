DO $do$
DECLARE src text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO src
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname='public' AND p.proname='fn_sync_normalized_from_lead';

  IF src IS NULL THEN RAISE EXCEPTION 'function not found'; END IF;

  src := replace(src, 'v_lead.pessoa_nascimento::date', 'public.fn_safe_date(v_lead.pessoa_nascimento::text)');

  EXECUTE src;
END
$do$;