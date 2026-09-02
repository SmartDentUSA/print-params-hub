CREATE TABLE public.professional_course_ratings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id uuid NOT NULL REFERENCES public.professional_courses(id) ON DELETE CASCADE,
  rating smallint NOT NULL,
  comment text,
  author_name text,
  visitor_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX professional_course_ratings_unique_visitor
  ON public.professional_course_ratings (course_id, visitor_key);
CREATE INDEX professional_course_ratings_course_idx
  ON public.professional_course_ratings (course_id);

CREATE OR REPLACE FUNCTION public.fn_validate_course_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.rating < 1 OR NEW.rating > 5 THEN
    RAISE EXCEPTION 'rating must be between 1 and 5';
  END IF;
  IF length(coalesce(NEW.visitor_key, '')) < 8 THEN
    RAISE EXCEPTION 'invalid visitor_key';
  END IF;
  NEW.comment := left(coalesce(NEW.comment, ''), 1000);
  IF NEW.comment = '' THEN NEW.comment := NULL; END IF;
  NEW.author_name := left(coalesce(NEW.author_name, ''), 120);
  IF NEW.author_name = '' THEN NEW.author_name := NULL; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_course_rating
BEFORE INSERT OR UPDATE ON public.professional_course_ratings
FOR EACH ROW EXECUTE FUNCTION public.fn_validate_course_rating();

GRANT SELECT, INSERT ON public.professional_course_ratings TO anon;
GRANT SELECT, INSERT, UPDATE ON public.professional_course_ratings TO authenticated;
GRANT ALL ON public.professional_course_ratings TO service_role;

ALTER TABLE public.professional_course_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Course ratings are publicly readable"
  ON public.professional_course_ratings FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can submit a course rating"
  ON public.professional_course_ratings FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);