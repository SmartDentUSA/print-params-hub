CREATE OR REPLACE FUNCTION public.list_unmapped_meta_forms()
RETURNS TABLE (form_id text, form_name text, leads_count bigint, last_lead_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH raw AS (
    SELECT COALESCE(NULLIF(la.meta_form_id, ''), NULLIF(la.platform_form_id, '')) AS fid,
           NULLIF(la.form_name, '') AS fname,
           la.created_at
    FROM public.lia_attendances la
    WHERE la.merged_into IS NULL
      AND COALESCE(NULLIF(la.meta_form_id, ''), NULLIF(la.platform_form_id, '')) IS NOT NULL
  )
  SELECT r.fid AS form_id,
         (array_agg(r.fname ORDER BY r.created_at DESC NULLS LAST) FILTER (WHERE r.fname IS NOT NULL))[1] AS form_name,
         count(*)::bigint AS leads_count,
         max(r.created_at) AS last_lead_at
  FROM raw r
  WHERE NOT EXISTS (SELECT 1 FROM public.meta_form_mappings m WHERE m.form_id = r.fid)
  GROUP BY r.fid
  ORDER BY count(*) DESC
$$;

REVOKE ALL ON FUNCTION public.list_unmapped_meta_forms() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_unmapped_meta_forms() TO authenticated, service_role;