CREATE OR REPLACE FUNCTION public.fn_public_course_professionals(_ids uuid[])
RETURNS TABLE (id uuid, nome text, prof_photo_url text, especialidade text, instagram text, prof_mini_cv text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT a.id, a.nome, a.prof_photo_url, a.especialidade, a.instagram, a.prof_mini_cv
  FROM public.lia_attendances a
  WHERE a.id = ANY(_ids)
    AND a.merged_into IS NULL
    AND (
      EXISTS (SELECT 1 FROM public.professional_courses pc
              WHERE pc.producer_lead_id = a.id AND pc.public_visible = true AND pc.status = 'publicado')
      OR EXISTS (SELECT 1 FROM public.smartops_courses sc
                 WHERE sc.active = true AND sc.public_visible = true
                   AND sc.recommend_on_instructor_card = true
                   AND a.id = ANY(sc.recommend_professional_ids))
    );
$$;
REVOKE ALL ON FUNCTION public.fn_public_course_professionals(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_public_course_professionals(uuid[]) TO anon, authenticated, service_role;