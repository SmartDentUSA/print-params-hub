CREATE OR REPLACE FUNCTION public.fn_public_event_combos(p_event_id uuid)
RETURNS TABLE(section_title text, section_description text, sort_order integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.title, s.description, s.sort_order
  FROM public.promotional_table_sections s
  JOIN public.promotional_tables t ON t.id = s.promotional_table_id
  WHERE t.event_id = p_event_id
    AND t.status = 'active'
  ORDER BY s.sort_order, s.title;
$$;

GRANT EXECUTE ON FUNCTION public.fn_public_event_combos(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.fn_public_event_combos(uuid) TO authenticated;