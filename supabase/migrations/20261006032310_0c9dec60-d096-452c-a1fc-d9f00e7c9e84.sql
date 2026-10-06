CREATE OR REPLACE FUNCTION public.fn_kol_form_leads(_names text[])
 RETURNS TABLE(form_key text, lead_id uuid)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT form_key, lead_id FROM (
    SELECT n.name AS form_key, COALESCE(l.merged_into, l.id) AS lead_id
    FROM unnest(_names) AS n(name)
    JOIN public.lia_attendances l ON l.form_name = n.name
    UNION
    SELECT n.name, COALESCE(l.merged_into, l.id)
    FROM unnest(_names) AS n(name)
    JOIN LATERAL (SELECT id, merged_into FROM public.lia_attendances WHERE form_data ? n.name) l ON true
  ) s
$function$;