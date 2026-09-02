GRANT SELECT ON public.professional_courses TO anon;
CREATE POLICY "Public can view published professional courses"
ON public.professional_courses FOR SELECT TO anon, authenticated
USING (public_visible IS TRUE AND status = 'publicado');