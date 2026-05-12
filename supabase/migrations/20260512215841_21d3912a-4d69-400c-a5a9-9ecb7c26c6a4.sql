-- Backfill: insert missing 9th digit on Brazilian mobile numbers (12 digits, subscriber starts with 6/7/8/9)
UPDATE public.lia_attendances
SET telefone_normalized =
  '+55' || substring(regexp_replace(telefone_normalized, '\D', '', 'g') from 3 for 2)
        || '9'
        || substring(regexp_replace(telefone_normalized, '\D', '', 'g') from 5)
WHERE merged_into IS NULL
  AND telefone_normalized IS NOT NULL
  AND length(regexp_replace(telefone_normalized, '\D', '', 'g')) = 12
  AND substring(regexp_replace(telefone_normalized, '\D', '', 'g') from 5 for 1) ~ '[6789]';