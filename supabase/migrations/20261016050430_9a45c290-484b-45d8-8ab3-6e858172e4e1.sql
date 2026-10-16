ALTER TABLE public.lia_attendances ADD COLUMN IF NOT EXISTS archived_at timestamptz;

UPDATE public.lia_attendances
SET archived_at = now()
WHERE archived_at IS NULL
  AND merged_into IS NULL
  AND (
    nome ILIKE '%teste%'
    OR nome ILIKE '[TESTE%'
    OR email ILIKE '%teste%'
    OR email ILIKE '%@smartdent.test'
    OR email ILIKE '%@placeholder.local' AND nome ILIKE '%test%'
    OR form_name ILIKE '%teste%'
    OR form_name ILIKE 'QA -%'
    OR form_name ILIKE '%QA TESTE%'
    OR telefone_normalized = '+5511999998888'
  );

CREATE INDEX IF NOT EXISTS idx_lia_attendances_archived_at ON public.lia_attendances (archived_at) WHERE archived_at IS NULL;