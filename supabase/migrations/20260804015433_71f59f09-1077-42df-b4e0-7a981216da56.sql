CREATE UNIQUE INDEX IF NOT EXISTS uq_lal_dedupe
  ON public.lead_activity_log (lead_id, event_type, dedupe_hash)
  WHERE dedupe_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lal_lead_ts
  ON public.lead_activity_log (lead_id, event_timestamp DESC);
DROP INDEX IF EXISTS public.idx_lal_dedupe_group;