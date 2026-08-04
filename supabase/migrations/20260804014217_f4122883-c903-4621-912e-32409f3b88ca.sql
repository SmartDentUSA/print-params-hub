CREATE TABLE IF NOT EXISTS public.lead_activity_log_dedup_backup_20260804
  (LIKE public.lead_activity_log);
ALTER TABLE public.lead_activity_log_dedup_backup_20260804
  ADD COLUMN IF NOT EXISTS purged_at timestamptz NOT NULL DEFAULT now();
GRANT ALL ON public.lead_activity_log_dedup_backup_20260804 TO service_role;
ALTER TABLE public.lead_activity_log_dedup_backup_20260804 ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_lal_dedupe_group
  ON public.lead_activity_log (lead_id, event_type, dedupe_hash) WHERE dedupe_hash IS NOT NULL;