CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE OR REPLACE FUNCTION public.wa_normalize_name(p_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, extensions
AS $$
  SELECT btrim(regexp_replace(
    regexp_replace(
      regexp_replace(lower(public.unaccent(coalesce(p_name, ''))), '[^a-z0-9 ]', ' ', 'g'),
      '\y(dr|dra|doutor|doutora|sr|sra|lab|laboratorio|clinica|odonto)\y', ' ', 'g'),
    '\s+', ' ', 'g'))
$$;

CREATE INDEX IF NOT EXISTS idx_lia_attendances_wa_norm_name
  ON public.lia_attendances (public.wa_normalize_name(nome))
  WHERE merged_into IS NULL;

CREATE OR REPLACE FUNCTION public.wa_match_leads_by_names(p_names text[])
RETURNS TABLE(norm_name text, lead_id uuid, match_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH wanted AS (
    SELECT DISTINCT public.wa_normalize_name(n) AS norm_name
    FROM unnest(p_names) AS n
    WHERE public.wa_normalize_name(n) <> ''
  ),
  hits AS (
    SELECT w.norm_name, l.id, count(*) OVER (PARTITION BY w.norm_name) AS cnt
    FROM wanted w
    JOIN public.lia_attendances l
      ON l.merged_into IS NULL
     AND public.wa_normalize_name(l.nome) = w.norm_name
  )
  SELECT norm_name, id, cnt FROM hits WHERE cnt = 1
$$;

GRANT EXECUTE ON FUNCTION public.wa_match_leads_by_names(text[]) TO service_role;