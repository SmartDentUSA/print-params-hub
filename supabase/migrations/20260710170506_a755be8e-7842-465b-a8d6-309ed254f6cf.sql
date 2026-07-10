-- Seed active meta forms & cursor
INSERT INTO public.cron_state (key, value, meta, updated_at)
VALUES
  ('meta_pull_forms', 0, jsonb_build_object('form_ids', jsonb_build_array(
      '4309081142703799','1853424102139156','1789308268708562','994460442184175'
   ), 'note', 'Managed by admin. Add new form_ids here when creating new Meta Lead Forms.'), now()),
  ('meta_pull_form_idx', 0, '{}'::jsonb, now())
ON CONFLICT (key) DO NOTHING;

-- Atomic round-robin claim with FOR UPDATE SKIP LOCKED on the cursor row.
-- Returns NULL when another invocation currently holds the cursor -> caller
-- should exit early (next cron tick picks it up).
CREATE OR REPLACE FUNCTION public.claim_next_meta_pull_form()
RETURNS TABLE(form_id text, idx int, total int, fallback_used boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_forms   jsonb;
  v_total   int;
  v_cur     int;
  v_next    int;
  v_form    text;
  v_fallback boolean := false;
  v_locked_row record;
BEGIN
  -- Load configured forms (source of truth)
  SELECT meta->'form_ids' INTO v_forms
    FROM public.cron_state WHERE key = 'meta_pull_forms';

  IF v_forms IS NULL OR jsonb_typeof(v_forms) <> 'array' OR jsonb_array_length(v_forms) = 0 THEN
    v_forms := jsonb_build_array(
      '4309081142703799','1853424102139156','1789308268708562','994460442184175'
    );
    v_fallback := true;
  END IF;

  v_total := jsonb_array_length(v_forms);

  -- Lock cursor row exclusively; if another tx holds it, return empty (caller skips)
  SELECT * INTO v_locked_row
    FROM public.cron_state
    WHERE key = 'meta_pull_form_idx'
    FOR UPDATE SKIP LOCKED;

  IF NOT FOUND THEN
    RETURN;  -- concurrent invocation running; skip this tick
  END IF;

  v_cur  := COALESCE(v_locked_row.value, 0);
  IF v_cur < 0 OR v_cur >= v_total THEN v_cur := 0; END IF;
  v_next := (v_cur + 1) % v_total;
  v_form := v_forms->>v_cur;

  UPDATE public.cron_state
     SET value = v_next, updated_at = now()
   WHERE key = 'meta_pull_form_idx';

  form_id       := v_form;
  idx           := v_cur;
  total         := v_total;
  fallback_used := v_fallback;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_next_meta_pull_form() TO service_role;