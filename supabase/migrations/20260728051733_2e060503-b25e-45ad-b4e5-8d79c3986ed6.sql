-- =====================================================================
-- Gate 2 · Migration 2 — Merge-chain flatten (blocking) + view hardening
-- =====================================================================

-- ---------------------------------------------------------------------
-- 2.2.2  Flatten trigger — resolve merged_into to root before write,
--        block on chains > 10 or on cycles.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_guard_lia_flatten_merge()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current     UUID;
  v_next        UUID;
  v_hops        INTEGER := 0;
  v_max_hops    CONSTANT INTEGER := 10;
  v_visited     UUID[] := ARRAY[]::UUID[];
  v_original    UUID;
BEGIN
  -- Only act when merged_into is being set to a non-null value.
  IF NEW.merged_into IS NULL THEN
    RETURN NEW;
  END IF;

  -- If no change (UPDATE that doesn't touch merged_into meaningfully), no-op.
  IF TG_OP = 'UPDATE' AND OLD.merged_into IS NOT DISTINCT FROM NEW.merged_into THEN
    RETURN NEW;
  END IF;

  -- The anti-self-ref trigger already blocks NEW.merged_into = NEW.id;
  -- we defensively re-check to avoid infinite loop if trigger order changes.
  IF NEW.merged_into = NEW.id THEN
    RAISE EXCEPTION 'gate2_self_merge_blocked_in_flatten: lead %', NEW.id
      USING ERRCODE = 'check_violation';
  END IF;

  v_original := NEW.merged_into;
  v_current  := NEW.merged_into;
  v_visited  := ARRAY[NEW.id];  -- treat the row being written as already visited

  -- Walk the chain: NEW.merged_into -> its merged_into -> ... until NULL/root.
  LOOP
    -- Cycle detection: if v_current already in visited, block.
    IF v_current = ANY(v_visited) THEN
      BEGIN
        INSERT INTO public.system_health_logs
          (function_name, severity, error_type, lead_id, details)
        VALUES
          ('gate2.trg_lia_flatten_merge',
           'error',
           'merge_cycle_detected',
           NEW.id,
           jsonb_build_object(
             'operation', TG_OP,
             'attempted_merged_into', v_original,
             'cycle_at', v_current,
             'visited', to_jsonb(v_visited),
             'hops', v_hops
           ));
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
      RAISE EXCEPTION 'gate2_merge_cycle_detected: chain visits % twice starting from lead %',
        v_current, NEW.id
        USING ERRCODE = 'check_violation';
    END IF;

    v_visited := v_visited || v_current;

    SELECT merged_into INTO v_next
    FROM public.lia_attendances
    WHERE id = v_current;

    -- If the pointer target doesn't exist, treat as broken chain and block.
    -- (Row-not-found → v_next remains NULL AND no row was found.)
    IF NOT FOUND THEN
      BEGIN
        INSERT INTO public.system_health_logs
          (function_name, severity, error_type, lead_id, details)
        VALUES
          ('gate2.trg_lia_flatten_merge',
           'error',
           'merge_target_missing',
           NEW.id,
           jsonb_build_object(
             'operation', TG_OP,
             'attempted_merged_into', v_original,
             'missing_target', v_current,
             'hops', v_hops
           ));
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
      RAISE EXCEPTION 'gate2_merge_target_missing: target % does not exist (from lead %)',
        v_current, NEW.id
        USING ERRCODE = 'foreign_key_violation';
    END IF;

    -- Root reached: v_current is a canonical lead.
    IF v_next IS NULL THEN
      EXIT;
    END IF;

    -- Advance
    v_current := v_next;
    v_hops    := v_hops + 1;

    IF v_hops > v_max_hops THEN
      BEGIN
        INSERT INTO public.system_health_logs
          (function_name, severity, error_type, lead_id, details)
        VALUES
          ('gate2.trg_lia_flatten_merge',
           'error',
           'merge_chain_too_deep',
           NEW.id,
           jsonb_build_object(
             'operation', TG_OP,
             'attempted_merged_into', v_original,
             'hops', v_hops,
             'max_hops', v_max_hops,
             'last_seen', v_current,
             'visited', to_jsonb(v_visited)
           ));
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
      RAISE EXCEPTION 'gate2_merge_chain_too_deep: chain exceeded % hops from lead %',
        v_max_hops, NEW.id
        USING ERRCODE = 'check_violation';
    END IF;
  END LOOP;

  -- If flatten changed the target, rewrite and log the resolution (info, not error).
  IF v_current IS DISTINCT FROM v_original THEN
    NEW.merged_into := v_current;

    BEGIN
      INSERT INTO public.system_health_logs
        (function_name, severity, error_type, lead_id, details)
      VALUES
        ('gate2.trg_lia_flatten_merge',
         'info',
         'merge_chain_flattened',
         NEW.id,
         jsonb_build_object(
           'operation', TG_OP,
           'original_target', v_original,
           'root_target', v_current,
           'hops', v_hops
         ));
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gate2_lia_flatten_merge ON public.lia_attendances;

-- Ordering matters: anti-self-ref runs first (alphabetical trigger names in Postgres).
-- 'trg_gate2_lia_flatten_merge' > 'trg_gate2_lia_no_self_merge' alphabetically,
-- so anti-self-ref (no_self_merge) fires first. This is the desired order.
CREATE TRIGGER trg_gate2_lia_flatten_merge
BEFORE INSERT OR UPDATE OF merged_into
ON public.lia_attendances
FOR EACH ROW
EXECUTE FUNCTION public.fn_guard_lia_flatten_merge();

COMMENT ON FUNCTION public.fn_guard_lia_flatten_merge() IS
  'Gate 2 (Migration 2): resolves merged_into to the canonical root before write. '
  'Blocks writes when chain > 10 hops or when a cycle is detected. '
  'Never writes a partially-resolved merged_into.';

-- ---------------------------------------------------------------------
-- View hardening: fix Supabase linter "Security Definer View" ERROR
-- from Migration 1. Views themselves become security-invoker; access
-- control stays on fn_gate2_* functions (which are SECURITY DEFINER + has_role).
-- ---------------------------------------------------------------------
ALTER VIEW public.v_gate2_orphan_lead_id_columns   SET (security_invoker = true);
ALTER VIEW public.v_gate2_edge_function_config_drift SET (security_invoker = true);