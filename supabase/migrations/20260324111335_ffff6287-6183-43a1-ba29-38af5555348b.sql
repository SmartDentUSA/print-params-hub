-- Backfill: Set lead_status = 'CLIENTE_ativo' for won leads stuck in intermediate stages
UPDATE lia_attendances
SET lead_status = 'CLIENTE_ativo', updated_at = now()
WHERE status_oportunidade = 'ganha'
  AND merged_into IS NULL
  AND lead_status IS DISTINCT FROM 'CLIENTE_ativo';