CREATE INDEX IF NOT EXISTS idx_lia_attendances_raw_payload_gin
  ON public.lia_attendances
  USING gin (raw_payload jsonb_path_ops);