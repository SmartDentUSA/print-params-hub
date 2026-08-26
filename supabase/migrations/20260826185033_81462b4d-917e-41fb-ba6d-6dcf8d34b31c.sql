CREATE OR REPLACE FUNCTION public.fn_kol_form_leads(_names text[])
RETURNS TABLE(form_key text, lead_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT n.name AS form_key,
         COALESCE(l.merged_into, l.id) AS lead_id
  FROM unnest(_names) AS n(name)
  JOIN public.lia_attendances l
    ON l.form_name = n.name
    OR (l.form_data ? n.name)
  GROUP BY 1, 2
$$;

GRANT EXECUTE ON FUNCTION public.fn_kol_form_leads(text[]) TO authenticated, service_role;