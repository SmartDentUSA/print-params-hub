CREATE OR REPLACE FUNCTION public.fn_professional_course_lead_stats_portal(p_professional_id uuid, p_from date DEFAULT NULL, p_to date DEFAULT NULL)
 RETURNS TABLE(course_id uuid, course_title text, course_slug text, leads bigint, won_leads bigint, won_deals bigint, won_value numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH links AS (
    SELECT DISTINCT c.id AS course_id, c.title, c.slug
    FROM public.smartops_courses c
    WHERE c.instructor_lead_id = p_professional_id
       OR p_professional_id = ANY(COALESCE(c.recommend_professional_ids, '{}'::uuid[]))
       OR EXISTS (SELECT 1 FROM public.professional_courses pc
                  WHERE pc.source_smartops_course_id = c.id AND pc.producer_lead_id = p_professional_id)
  ),
  subs AS (
    SELECT COALESCE(l.merged_into, l.id) AS lead_id,
           (a.event_data->>'course_id')::uuid AS course_id,
           MIN(a.event_timestamp) AS first_at
    FROM public.lead_activity_log a
    JOIN public.lia_attendances l ON l.id = a.lead_id
    WHERE a.event_type IN ('inscricao_curso_publica', 'inscricao_lista_espera')
      AND a.event_data->>'course_id' ~ '^[0-9a-f-]{36}$'
      AND (a.event_data->>'course_id')::uuid IN (SELECT course_id FROM links)
    GROUP BY 1, 2
  ),
  canon AS (
    SELECT s.* FROM subs s
    JOIN public.lia_attendances c ON c.id = s.lead_id AND c.merged_into IS NULL
  ),
  won AS (
    SELECT DISTINCT ON (s.course_id, d.piperun_deal_id)
           s.course_id, s.lead_id, d.piperun_deal_id, COALESCE(d.value, 0) AS value
    FROM canon s
    JOIN public.lia_attendances la ON COALESCE(la.merged_into, la.id) = s.lead_id
    JOIN public.deals d ON d.lead_id = la.id
    WHERE d.status = 'ganha' AND COALESCE(d.is_deleted, false) = false
      AND COALESCE(d.closed_at, d.piperun_updated_at) >= s.first_at
      AND (p_from IS NULL OR COALESCE(d.closed_at, d.piperun_updated_at)::date >= p_from)
      AND (p_to IS NULL OR COALESCE(d.closed_at, d.piperun_updated_at)::date <= p_to)
  )
  SELECT k.course_id, k.title, k.slug,
         (SELECT count(*) FROM canon s WHERE s.course_id = k.course_id
            AND (p_from IS NULL OR s.first_at::date >= p_from)
            AND (p_to IS NULL OR s.first_at::date <= p_to)),
         (SELECT count(DISTINCT w.lead_id) FROM won w WHERE w.course_id = k.course_id),
         (SELECT count(*) FROM won w WHERE w.course_id = k.course_id),
         (SELECT COALESCE(sum(w.value), 0) FROM won w WHERE w.course_id = k.course_id)
  FROM links k;
$function$;

REVOKE ALL ON FUNCTION public.fn_professional_course_lead_stats_portal(uuid, date, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_professional_course_lead_stats_portal(uuid, date, date) TO service_role;