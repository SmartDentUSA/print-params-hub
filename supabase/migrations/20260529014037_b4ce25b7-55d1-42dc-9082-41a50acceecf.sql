UPDATE public.lia_attendances
SET
  telefone_raw = COALESCE(telefone_raw, '+5531993252575'),
  telefone_normalized = COALESCE(telefone_normalized, '5531993252575')
WHERE email = 'fvteche@yahoo.com.br'
  AND merged_into IS NULL
  AND telefone_normalized IS NULL;