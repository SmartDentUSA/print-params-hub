CREATE OR REPLACE FUNCTION public.fn_increment_course_view(_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.professional_courses SET views_count = COALESCE(views_count,0) + 1
  WHERE id = _id OR source_smartops_course_id = _id;
$$;
REVOKE ALL ON FUNCTION public.fn_increment_course_view(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.fn_increment_course_view(uuid) TO anon, authenticated, service_role;