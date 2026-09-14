CREATE OR REPLACE FUNCTION public.fn_public_event_consultants(p_form_id uuid)
RETURNS TABLE(id uuid, nome_completo text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tm.id, tm.nome_completo
  FROM public.smartops_forms f
  JOIN public.team_members tm
    ON tm.id = ANY (COALESCE(f.event_consultant_ids, '{}'::uuid[]))
  WHERE f.id = p_form_id
    AND tm.ativo = true
  ORDER BY tm.nome_completo
$$;

GRANT EXECUTE ON FUNCTION public.fn_public_event_consultants(uuid) TO anon, authenticated;