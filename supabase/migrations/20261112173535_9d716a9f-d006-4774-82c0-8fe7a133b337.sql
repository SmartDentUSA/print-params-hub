ALTER TABLE public.smartops_short_links DROP CONSTRAINT smartops_short_links_default_target_check;
ALTER TABLE public.smartops_short_links ADD CONSTRAINT smartops_short_links_default_target_check
  CHECK (default_target::text = ANY (ARRAY['form','landing_page','whatsapp']::text[]));

CREATE OR REPLACE FUNCTION public.generate_short_link(p_form_slug text, p_target character varying)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_alphabet CONSTANT text := 'abcdefghijkmnpqrstuvwxyz23456789';
  v_len CONSTANT int := 32;
  v_existing text;
  v_code text;
  v_attempt int := 0;
BEGIN
  IF p_target NOT IN ('form','landing_page','whatsapp') THEN
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
$function$;