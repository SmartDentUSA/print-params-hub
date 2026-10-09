UPDATE public.smartops_courses c
SET recommend_professional_ids = sub.ids
FROM (
  SELECT c2.id AS course_id, array_agg(DISTINCT la.id) AS ids
  FROM public.smartops_courses c2
  JOIN public.lia_attendances la
    ON la.merged_into IS NULL
   AND la.nome IS NOT NULL
   AND trim(regexp_replace(regexp_replace(lower(unaccent(la.nome)), '\m(prof|dr|dra|doutor|doutora|professor|professora)\M', ' ', 'g'), '[^a-z]+', ' ', 'g'))
     = trim(regexp_replace(regexp_replace(lower(unaccent(c2.instructor_name)), '\m(prof|dr|dra|doutor|doutora|professor|professora)\M', ' ', 'g'), '[^a-z]+', ' ', 'g'))
  WHERE c2.recommend_on_instructor_card = true
    AND c2.active = true
    AND c2.instructor_name IS NOT NULL
    AND c2.recommend_professional_ids = '{}'
  GROUP BY c2.id
) sub
WHERE c.id = sub.course_id;