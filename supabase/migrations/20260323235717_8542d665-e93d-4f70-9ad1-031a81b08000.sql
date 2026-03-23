-- Backfill: Add missing tags for leads with status_oportunidade = 'ganha' but missing C_CONTRATO_FECHADO
UPDATE lia_attendances
SET 
  tags_crm = (
    SELECT ARRAY(
      SELECT DISTINCT unnest
      FROM unnest(
        COALESCE(tags_crm, '{}') || 
        ARRAY['C_CONTRATO_FECHADO', 'J04_COMPRA', 'C_PQL_RECOMPRA', 'C_OPP_ENCERRADA_COMPRA', 'C_REENTRADA_NUTRICAO']
      ) AS unnest
      ORDER BY unnest
    )
  ),
  updated_at = now()
WHERE status_oportunidade = 'ganha'
  AND merged_into IS NULL
  AND (tags_crm IS NULL OR NOT tags_crm @> ARRAY['C_CONTRATO_FECHADO']);

-- Backfill: Fix leads with won deals in history but status_oportunidade still showing 'aberta' or NULL
UPDATE lia_attendances
SET 
  status_oportunidade = 'ganha',
  tags_crm = (
    SELECT ARRAY(
      SELECT DISTINCT unnest
      FROM unnest(
        COALESCE(tags_crm, '{}') || 
        ARRAY['C_CONTRATO_FECHADO', 'J04_COMPRA', 'C_PQL_RECOMPRA', 'C_OPP_ENCERRADA_COMPRA', 'C_REENTRADA_NUTRICAO']
      ) AS unnest
      ORDER BY unnest
    )
  ),
  updated_at = now()
WHERE merged_into IS NULL
  AND (status_oportunidade IS NULL OR status_oportunidade IN ('aberta', ''))
  AND piperun_deals_history IS NOT NULL
  AND piperun_deals_history::text ILIKE '%"status":"ganha"%'
  AND (tags_crm IS NULL OR NOT tags_crm @> ARRAY['C_CONTRATO_FECHADO']);