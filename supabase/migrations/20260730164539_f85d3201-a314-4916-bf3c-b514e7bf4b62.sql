ALTER TABLE public.zernio_leadgen_dedup
  ADD COLUMN IF NOT EXISTS process_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS process_error  text,
  ADD COLUMN IF NOT EXISTS retry_count    integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS completed_at   timestamptz,
  ADD COLUMN IF NOT EXISTS raw_payload    jsonb;

ALTER TABLE public.zernio_leadgen_dedup
  DROP CONSTRAINT IF EXISTS zernio_leadgen_dedup_process_status_chk;

ALTER TABLE public.zernio_leadgen_dedup
  ADD CONSTRAINT zernio_leadgen_dedup_process_status_chk
  CHECK (process_status IN ('pending','done','failed'));

UPDATE public.zernio_leadgen_dedup
   SET process_status='done', completed_at=processed_at
 WHERE lead_id IS NOT NULL AND process_status='pending';

CREATE INDEX IF NOT EXISTS idx_zernio_dedup_pendentes
  ON public.zernio_leadgen_dedup (processed_at)
  WHERE process_status <> 'done';

GRANT SELECT, INSERT, UPDATE ON public.zernio_leadgen_dedup TO service_role;