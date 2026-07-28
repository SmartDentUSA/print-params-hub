-- =====================================================================
-- Gate 2 · Migration 1 — Stop new identity corruption sources
-- Scope: preventive only. Zero writes to existing rows.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 2.2.1  Anti-self-reference trigger on lia_attendances
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_guard_lia_no_self_merge()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.merged_into IS NOT NULL AND NEW.merged_into = NEW.id THEN
    -- Log for observability (best-effort, do not fail the raise if log insert fails)
    BEGIN
      INSERT INTO public.system_health_logs
        (function_name, severity, error_type, lead_id, details)
      VALUES
        ('gate2.trg_lia_no_self_merge',
         'error',
         'self_reference_blocked',
         NEW.id,
         jsonb_build_object(
           'operation', TG_OP,
           'attempted_merged_into', NEW.merged_into,
           'lead_id', NEW.id
         ));
    EXCEPTION WHEN OTHERS THEN
      -- swallow logging errors; the RAISE below is the source of truth
      NULL;
    END;

    RAISE EXCEPTION 'gate2_self_merge_blocked: lead % cannot merge into itself', NEW.id
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gate2_lia_no_self_merge ON public.lia_attendances;

CREATE TRIGGER trg_gate2_lia_no_self_merge
BEFORE INSERT OR UPDATE OF merged_into
ON public.lia_attendances
FOR EACH ROW
EXECUTE FUNCTION public.fn_guard_lia_no_self_merge();

COMMENT ON FUNCTION public.fn_guard_lia_no_self_merge() IS
  'Gate 2 (Migration 1): blocks INSERT/UPDATE that sets merged_into = id. '
  'Does NOT touch the 158 pre-existing self-refs — those are handled in Gate 3.';

-- ---------------------------------------------------------------------
-- 2.2.4  Read-only inventory: *_lead_id columns without FK to lia_attendances
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_gate2_orphan_lead_id_columns AS
WITH candidate_cols AS (
  SELECT
    c.table_schema,
    c.table_name,
    c.column_name,
    c.data_type,
    c.is_nullable
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND (c.column_name = 'lead_id' OR c.column_name LIKE '%\_lead\_id' ESCAPE '\')
),
fk_cols AS (
  SELECT
    tc.table_schema,
    tc.table_name,
    kcu.column_name,
    ccu.table_name  AS references_table
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
   AND tc.table_schema   = kcu.table_schema
  JOIN information_schema.constraint_column_usage ccu
    ON tc.constraint_name = ccu.constraint_name
   AND tc.table_schema   = ccu.table_schema
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema    = 'public'
)
SELECT
  cc.table_name,
  cc.column_name,
  cc.data_type,
  cc.is_nullable,
  CASE
    WHEN fk.column_name IS NULL THEN 'no_fk'
    WHEN fk.references_table <> 'lia_attendances' THEN 'fk_to_other'
    ELSE 'fk_ok'
  END AS fk_status,
  fk.references_table AS current_reference
FROM candidate_cols cc
LEFT JOIN fk_cols fk
  ON  fk.table_schema = cc.table_schema
  AND fk.table_name   = cc.table_name
  AND fk.column_name  = cc.column_name
WHERE COALESCE(
        CASE
          WHEN fk.column_name IS NULL THEN 'no_fk'
          WHEN fk.references_table <> 'lia_attendances' THEN 'fk_to_other'
          ELSE 'fk_ok'
        END,
        'no_fk'
      ) <> 'fk_ok'
ORDER BY cc.table_name, cc.column_name;

COMMENT ON VIEW public.v_gate2_orphan_lead_id_columns IS
  'Gate 2 (Migration 1): inventory of *_lead_id columns without FK to lia_attendances. '
  'Read-only. Feeds Gate 3 FK reconciliation plan. Does not alter any table.';

-- Access: admins + service_role only (no anon, no authenticated broad access)
REVOKE ALL ON public.v_gate2_orphan_lead_id_columns FROM PUBLIC;
GRANT SELECT ON public.v_gate2_orphan_lead_id_columns TO service_role;

-- Wrap under authenticated with role check via a security-definer function
CREATE OR REPLACE FUNCTION public.fn_gate2_orphan_lead_id_columns()
RETURNS SETOF public.v_gate2_orphan_lead_id_columns
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.v_gate2_orphan_lead_id_columns
  WHERE public.has_role(auth.uid(), 'admin');
$$;

GRANT EXECUTE ON FUNCTION public.fn_gate2_orphan_lead_id_columns() TO authenticated;

-- ---------------------------------------------------------------------
-- 2.2.5  Read-only view: edge function config drift
--        (declared in config.toml vs. present in supabase/functions/)
--        The declared-verify_jwt value is loaded via a companion seed; for
--        undeclared slugs the field is NULL — MUST be confirmed via
--        Management API (Gate 0 Part B). This view NEVER asserts a default.
-- ---------------------------------------------------------------------

-- Backing table for config.toml declarations. Populated manually / by ops.
CREATE TABLE IF NOT EXISTS public.gate2_config_toml_snapshot (
  slug              TEXT PRIMARY KEY,
  verify_jwt        BOOLEAN,          -- as declared in config.toml
  raw_block         TEXT,
  snapshot_taken_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes             TEXT
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gate2_config_toml_snapshot TO service_role;
GRANT SELECT ON public.gate2_config_toml_snapshot TO authenticated;

ALTER TABLE public.gate2_config_toml_snapshot ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gate2_config_snapshot_admin_read" ON public.gate2_config_toml_snapshot;
CREATE POLICY "gate2_config_snapshot_admin_read"
  ON public.gate2_config_toml_snapshot
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Filesystem snapshot table: populated by ops from `ls supabase/functions/`.
CREATE TABLE IF NOT EXISTS public.gate2_functions_fs_snapshot (
  slug              TEXT PRIMARY KEY,
  has_index_ts      BOOLEAN NOT NULL DEFAULT true,
  snapshot_taken_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gate2_functions_fs_snapshot TO service_role;
GRANT SELECT ON public.gate2_functions_fs_snapshot TO authenticated;

ALTER TABLE public.gate2_functions_fs_snapshot ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gate2_fs_snapshot_admin_read" ON public.gate2_functions_fs_snapshot;
CREATE POLICY "gate2_fs_snapshot_admin_read"
  ON public.gate2_functions_fs_snapshot
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- The drift view. verify_jwt_declared is NULL when the slug is not in config.toml.
-- verify_jwt_effective is intentionally NOT computed — the runtime value must
-- come from the Management API. This view never assumes a default.
CREATE OR REPLACE VIEW public.v_gate2_edge_function_config_drift AS
SELECT
  COALESCE(fs.slug, cfg.slug) AS slug,
  (fs.slug IS NOT NULL)       AS present_in_repo,
  (cfg.slug IS NOT NULL)      AS declared_in_config_toml,
  cfg.verify_jwt              AS verify_jwt_declared,
  CASE
    WHEN fs.slug IS NOT NULL AND cfg.slug IS NOT NULL THEN 'declared_and_present'
    WHEN fs.slug IS NOT NULL AND cfg.slug IS NULL     THEN 'orphan_of_config'
    WHEN fs.slug IS NULL     AND cfg.slug IS NOT NULL THEN 'orphan_of_code'
  END AS drift_status,
  'runtime verify_jwt must be confirmed via Supabase Management API — do not assume default'::TEXT
    AS verify_jwt_effective_note
FROM public.gate2_functions_fs_snapshot fs
FULL OUTER JOIN public.gate2_config_toml_snapshot cfg USING (slug);

COMMENT ON VIEW public.v_gate2_edge_function_config_drift IS
  'Gate 2 (Migration 1): declared vs. present drift for edge functions. '
  'verify_jwt_declared reflects config.toml only. Runtime effective value MUST '
  'be verified via Management API (Gate 0 Part B). This view never asserts a default.';

REVOKE ALL ON public.v_gate2_edge_function_config_drift FROM PUBLIC;
GRANT SELECT ON public.v_gate2_edge_function_config_drift TO service_role;

CREATE OR REPLACE FUNCTION public.fn_gate2_edge_function_config_drift()
RETURNS SETOF public.v_gate2_edge_function_config_drift
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.v_gate2_edge_function_config_drift
  WHERE public.has_role(auth.uid(), 'admin');
$$;

GRANT EXECUTE ON FUNCTION public.fn_gate2_edge_function_config_drift() TO authenticated;