-- Normalize telefone_normalized: remove '+' prefix from all records
UPDATE lia_attendances 
SET telefone_normalized = regexp_replace(telefone_normalized, '^\+', '') 
WHERE telefone_normalized LIKE '+%';