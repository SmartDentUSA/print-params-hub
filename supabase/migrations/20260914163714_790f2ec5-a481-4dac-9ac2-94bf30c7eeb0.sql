DROP FUNCTION IF EXISTS public.fn_public_event_combos(uuid);

CREATE FUNCTION public.fn_public_event_combos(p_event_id uuid)
RETURNS TABLE(section_title text, section_description text, section_image_url text, sort_order integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.title,
         s.description,
         COALESCE(
           s.image_url,
           (SELECT i.image_url
              FROM promotional_table_items i
             WHERE i.section_id = s.id
               AND i.image_url IS NOT NULL
             ORDER BY i.sort_order NULLS LAST
             LIMIT 1)
         ) AS section_image_url,
         s.sort_order
    FROM promotional_table_sections s
    JOIN promotional_tables t ON t.id = s.promotional_table_id
   WHERE t.status = 'active'
     AND t.event_id = p_event_id
   ORDER BY s.sort_order NULLS LAST, s.title
$$;

GRANT EXECUTE ON FUNCTION public.fn_public_event_combos(uuid) TO anon, authenticated;