CREATE INDEX IF NOT EXISTS lia_attendances_cnpj_digits_idx
  ON public.lia_attendances ((regexp_replace(empresa_cnpj, '\D', '', 'g')))
  WHERE empresa_cnpj IS NOT NULL;

CREATE INDEX IF NOT EXISTS lia_attendances_cpf_digits_idx
  ON public.lia_attendances ((regexp_replace(pessoa_cpf, '\D', '', 'g')))
  WHERE pessoa_cpf IS NOT NULL;

CREATE OR REPLACE FUNCTION public.fn_find_lead_by_tax_id(_tax_id text)
RETURNS TABLE (lead_id uuid, nome text, matched_by text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH d AS (SELECT regexp_replace(coalesce(_tax_id, ''), '\D', '', 'g') AS v)
  SELECT l.id, l.nome,
         CASE WHEN regexp_replace(coalesce(l.empresa_cnpj,''), '\D', '', 'g') = (SELECT v FROM d)
              THEN 'cnpj' ELSE 'cpf' END
  FROM public.lia_attendances l, d
  WHERE l.merged_into IS NULL
    AND length(d.v) IN (11, 14)
    AND (
      (length(d.v) = 14 AND regexp_replace(coalesce(l.empresa_cnpj,''), '\D', '', 'g') = d.v)
      OR
      (length(d.v) = 11 AND regexp_replace(coalesce(l.pessoa_cpf,''), '\D', '', 'g') = d.v)
    )
  ORDER BY l.piperun_id IS NOT NULL DESC, l.updated_at DESC NULLS LAST
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.fn_find_lead_by_tax_id(text) TO authenticated, service_role;