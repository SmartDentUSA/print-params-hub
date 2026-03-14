-- ============================================
-- DATA UPDATE: Recalculate proposals_total_value from piperun_deals_history
-- Source: piperun_deals_history (4,760 leads) — NOT deal_items (1 lead)
-- ============================================

-- 1️⃣ Update proposals_total_value from piperun_deals_history
UPDATE public.lia_attendances
SET
  proposals_total_value = COALESCE((
    SELECT SUM(COALESCE((d->>'value')::numeric, 0))
    FROM jsonb_array_elements(piperun_deals_history) d
  ), 0),
  updated_at = NOW()
WHERE piperun_deals_history IS NOT NULL
  AND jsonb_typeof(piperun_deals_history) = 'array'
  AND jsonb_array_length(piperun_deals_history) > 0;

-- 2️⃣ Update RFM score for leads with deals but score = 0
UPDATE public.lia_attendances
SET
  score = CASE
    WHEN jsonb_array_length(piperun_deals_history) >= 5 THEN 280
    WHEN jsonb_array_length(piperun_deals_history) >= 3 THEN 200
    WHEN jsonb_array_length(piperun_deals_history) >= 1 THEN 150
    ELSE 0
  END,
  updated_at = NOW()
WHERE piperun_deals_history IS NOT NULL
  AND jsonb_typeof(piperun_deals_history) = 'array'
  AND jsonb_array_length(piperun_deals_history) > 0
  AND (score IS NULL OR score = 0);

-- 3️⃣ Update status for leads with deals but no status
UPDATE public.lia_attendances
SET
  status_atual_lead_crm = 'cliente_ativo',
  updated_at = NOW()
WHERE piperun_deals_history IS NOT NULL
  AND jsonb_typeof(piperun_deals_history) = 'array'
  AND jsonb_array_length(piperun_deals_history) > 0
  AND (status_atual_lead_crm IS NULL OR status_atual_lead_crm = '');