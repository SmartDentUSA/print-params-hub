CREATE OR REPLACE FUNCTION public.claim_next_meta_pull_form()
RETURNS TABLE(form_id text, idx integer, total integer, fallback_used boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_forms jsonb;
  v_total integer;
  v_cur integer;
  v_next integer;
  v_form text;
  v_fallback boolean := false;
  v_locked_row public.cron_state%ROWTYPE;
BEGIN
  SELECT meta->'form_ids' INTO v_forms
  FROM public.cron_state
  WHERE key = 'meta_pull_forms';

  IF v_forms IS NULL OR jsonb_typeof(v_forms) <> 'array' OR jsonb_array_length(v_forms) = 0 THEN
    v_forms := jsonb_build_array(
      '4309081142703799', '1853424102139156', '1789308268708562', '994460442184175'
    );
    v_fallback := true;
  END IF;

  v_total := jsonb_array_length(v_forms);

  SELECT * INTO v_locked_row
  FROM public.cron_state
  WHERE key = 'meta_pull_form_idx'
  FOR UPDATE SKIP LOCKED;

  IF NOT FOUND THEN
    INSERT INTO public.cron_state (key, value, meta, updated_at)
    VALUES ('meta_pull_form_idx', '0', '{}'::jsonb, now())
    ON CONFLICT (key) DO NOTHING;

    SELECT * INTO v_locked_row
    FROM public.cron_state
    WHERE key = 'meta_pull_form_idx'
    FOR UPDATE SKIP LOCKED;

    IF NOT FOUND THEN RETURN; END IF;
  END IF;

  v_cur := COALESCE(NULLIF(v_locked_row.value::text, '')::integer, 0);
  IF v_cur < 0 OR v_cur >= v_total THEN v_cur := 0; END IF;
  v_next := (v_cur + 1) % v_total;
  v_form := v_forms->>v_cur;

  UPDATE public.cron_state
  SET value = v_next::text, updated_at = now()
  WHERE key = 'meta_pull_form_idx';

  form_id := v_form;
  idx := v_cur;
  total := v_total;
  fallback_used := v_fallback;
  RETURN NEXT;
END;
$function$;

REVOKE ALL ON FUNCTION public.claim_next_meta_pull_form() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_next_meta_pull_form() TO service_role;