CREATE TABLE public.smartops_bio_pages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  title text NOT NULL DEFAULT 'Smart Dent',
  subtitle text,
  logo_url text,
  social_links jsonb NOT NULL DEFAULT '{}'::jsonb,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  active boolean NOT NULL DEFAULT true,
  view_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.smartops_bio_pages TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.smartops_bio_pages TO authenticated;
GRANT ALL ON public.smartops_bio_pages TO service_role;

ALTER TABLE public.smartops_bio_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view active bio pages"
ON public.smartops_bio_pages FOR SELECT TO anon
USING (active = true);

CREATE POLICY "Authenticated can view bio pages"
ON public.smartops_bio_pages FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Admins manage bio pages insert"
ON public.smartops_bio_pages FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage bio pages update"
ON public.smartops_bio_pages FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage bio pages delete"
ON public.smartops_bio_pages FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_smartops_bio_pages_updated_at
BEFORE UPDATE ON public.smartops_bio_pages
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();