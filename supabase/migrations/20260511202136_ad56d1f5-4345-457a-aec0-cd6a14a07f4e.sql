-- 1) Drop the legacy "burn-on-first-attempt" flag for stuck leads so the new
--    backoff-aware cron can pick them up again.
UPDATE public.lia_attendances
SET raw_payload = raw_payload - 'piperun_retry_attempted_at'
WHERE merged_into IS NULL
  AND piperun_id IS NULL
  AND raw_payload ? 'piperun_retry_attempted_at';

-- 2) Partial index to keep the retry-failed-leads cron fast as the table grows.
CREATE INDEX IF NOT EXISTS idx_lia_attendances_piperun_pending
  ON public.lia_attendances (created_at DESC)
  WHERE merged_into IS NULL AND piperun_id IS NULL AND email IS NOT NULL;