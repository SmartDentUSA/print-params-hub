CREATE OR REPLACE FUNCTION public.find_lead_id_by_email_ci(p_email text, p_exclude_id uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT l.id
  FROM public.lia_attendances l
  WHERE lower(l.email) = lower(trim(p_email))
    AND l.merged_into IS NULL
    AND (p_exclude_id IS NULL OR l.id <> p_exclude_id)
  ORDER BY l.created_at ASC NULLS LAST, l.id ASC
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.find_lead_id_by_email_ci(text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.find_lead_id_by_email_ci(text, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.find_lead_id_by_email_ci(text, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.find_lead_id_by_email_ci(text, uuid) TO service_role;