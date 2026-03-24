
-- 1. Clear corrupted itens_proposta_parsed containing CSS garbage (696 leads)
UPDATE lia_attendances
SET itens_proposta_parsed = NULL,
    updated_at = now()
WHERE itens_proposta_parsed IS NOT NULL
  AND (
    itens_proposta_parsed::text ILIKE '%rgb(%'
    OR itens_proposta_parsed::text ILIKE '%font-size%'
    OR itens_proposta_parsed::text ILIKE '%font-family%'
    OR itens_proposta_parsed::text ILIKE '%text-decoration%'
  )
  AND merged_into IS NULL;

-- 2. Backfill owner_name in piperun_deals_history snapshots
UPDATE lia_attendances
SET piperun_deals_history = (
  SELECT jsonb_agg(
    CASE 
      WHEN (deal->>'owner_name') IS NULL 
      THEN deal || jsonb_build_object('owner_name', proprietario_lead_crm)
      ELSE deal
    END
  )
  FROM jsonb_array_elements(piperun_deals_history) deal
),
updated_at = now()
WHERE piperun_deals_history IS NOT NULL
  AND jsonb_typeof(piperun_deals_history) = 'array'
  AND proprietario_lead_crm IS NOT NULL
  AND piperun_deals_history::text LIKE '%"owner_name": null%'
  AND merged_into IS NULL;
