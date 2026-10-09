ALTER TABLE public.lia_attendances ADD COLUMN IF NOT EXISTS prof_display_name text;
ALTER TABLE public.professional_courses ADD COLUMN IF NOT EXISTS source_smartops_course_id uuid REFERENCES public.smartops_courses(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS professional_courses_source_unique ON public.professional_courses(producer_lead_id, source_smartops_course_id) WHERE source_smartops_course_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.fn_public_course_professionals(_ids uuid[])
RETURNS TABLE (id uuid, nome text, prof_photo_url text, especialidade text, instagram text, prof_mini_cv text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT a.id, COALESCE(NULLIF(trim(a.prof_display_name),''), a.nome), a.prof_photo_url, a.especialidade, a.instagram, a.prof_mini_cv
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