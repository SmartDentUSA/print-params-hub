-- Backfill: fix data_primeiro_contato for Loja Integrada leads that have a technical 2026 date
-- Use lojaintegrada_cliente_data_criacao as the real origin date when available

UPDATE lia_attendances
SET data_primeiro_contato = lojaintegrada_cliente_data_criacao
WHERE source = 'loja_integrada'
  AND merged_into IS NULL
  AND lojaintegrada_cliente_data_criacao IS NOT NULL
  AND lojaintegrada_cliente_data_criacao < '2026-01-01'
  AND (data_primeiro_contato IS NULL OR data_primeiro_contato >= '2026-01-01');