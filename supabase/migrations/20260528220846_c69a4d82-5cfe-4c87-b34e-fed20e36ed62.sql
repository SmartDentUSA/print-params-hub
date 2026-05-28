CREATE OR REPLACE FUNCTION public.increment_faq_views(_ids uuid[])
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.commercial_faqs
  SET view_count = view_count + 1
  WHERE id = ANY(_ids);
$$;

GRANT EXECUTE ON FUNCTION public.increment_faq_views(uuid[]) TO authenticated, service_role;