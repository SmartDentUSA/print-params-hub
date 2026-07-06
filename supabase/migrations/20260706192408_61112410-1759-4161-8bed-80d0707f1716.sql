
CREATE TABLE public.smartops_short_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  short_code varchar(8) NOT NULL UNIQUE,
  form_slug varchar NOT NULL,
  default_target varchar NOT NULL CHECK (default_target IN ('form','landing_page')),
  click_count int NOT NULL DEFAULT 0,
  last_clicked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX smartops_short_links_slug_target_uq
  ON public.smartops_short_links (form_slug, default_target);

GRANT SELECT ON public.smartops_short_links TO anon;
GRANT SELECT, INSERT, UPDATE ON public.smartops_short_links TO authenticated;
GRANT ALL ON public.smartops_short_links TO service_role;

ALTER TABLE public.smartops_short_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "short_links_public_read"
  ON public.smartops_short_links
  FOR SELECT
  USING (true);

CREATE POLICY "short_links_admin_insert"
  ON public.smartops_short_links
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "short_links_admin_update"
  ON public.smartops_short_links
  FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.generate_short_link(
  p_form_slug text,
  p_target varchar
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_alphabet CONSTANT text := 'abcdefghijkmnpqrstuvwxyz23456789';
  v_len CONSTANT int := 32;
  v_existing text;
  v_code text;
  v_attempt int := 0;
BEGIN
  IF p_target NOT IN ('form','landing_page') THEN
    RAISE EXCEPTION 'invalid target: %', p_target;
  END IF;

  IF p_form_slug IS NULL OR length(trim(p_form_slug)) = 0 THEN
    RAISE EXCEPTION 'form_slug required';
  END IF;

  SELECT short_code INTO v_existing
    FROM public.smartops_short_links
   WHERE form_slug = p_form_slug
     AND default_target = p_target
   LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  WHILE v_attempt < 5 LOOP
    v_attempt := v_attempt + 1;
    v_code := '';
    FOR i IN 1..6 LOOP
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * v_len)::int, 1);
    END LOOP;

    BEGIN
      INSERT INTO public.smartops_short_links (short_code, form_slug, default_target)
        VALUES (v_code, p_form_slug, p_target);
      RETURN v_code;
    EXCEPTION WHEN unique_violation THEN
      SELECT short_code INTO v_existing
        FROM public.smartops_short_links
       WHERE form_slug = p_form_slug
         AND default_target = p_target
       LIMIT 1;
      IF v_existing IS NOT NULL THEN
        RETURN v_existing;
      END IF;
    END;
  END LOOP;

  RAISE EXCEPTION 'could not generate unique short_code after % attempts', v_attempt;
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_short_link(text, varchar) TO authenticated;
