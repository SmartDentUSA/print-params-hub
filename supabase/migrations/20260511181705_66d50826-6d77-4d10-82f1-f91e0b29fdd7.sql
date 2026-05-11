
ALTER TABLE public.lia_attendances
  ADD COLUMN IF NOT EXISTS total_deals_all integer NOT NULL DEFAULT 0;

UPDATE public.lia_attendances la
SET
  total_deals_all = COALESCE(jsonb_array_length(la.piperun_deals_history), 0),
  total_deals = COALESCE((
    SELECT COUNT(*)::int
    FROM jsonb_array_elements(COALESCE(la.piperun_deals_history, '[]'::jsonb)) d
    WHERE LOWER(COALESCE(d->>'status','')) IN ('ganha','won')
  ), 0)
WHERE la.merged_into IS NULL;

UPDATE public.lia_attendances
SET merged_into = id,
    merged_at  = COALESCE(merged_at, now())
WHERE merged_into IS NULL
  AND piperun_id IS NULL
  AND email LIKE 'wa_%@whatsapp.lead'
  AND (nome ~ '^[0-9]+@lid$' OR nome ~ '^[0-9]+$' OR nome IS NULL);

CREATE INDEX IF NOT EXISTS lia_attendances_canonical_created_idx
  ON public.lia_attendances (created_at DESC)
  WHERE merged_into IS NULL;
