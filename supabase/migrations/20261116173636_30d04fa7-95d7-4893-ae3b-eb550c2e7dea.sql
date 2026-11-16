CREATE OR REPLACE FUNCTION public.trg_landing_page_short_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_slug text;
BEGIN
  IF NEW.status IS DISTINCT FROM 'published' THEN
    RETURN NEW;
  END IF;
  SELECT slug INTO v_slug FROM public.smartops_forms WHERE id = NEW.form_id;
  IF v_slug IS NULL OR length(trim(v_slug)) = 0 THEN
    RETURN NEW;
  END IF;
  BEGIN
    PERFORM public.generate_short_link(v_slug, 'landing_page');
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[landing short link] %: %', v_slug, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.trg_landing_page_short_link() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS landing_page_short_link ON public.smartops_form_landing_pages;
CREATE TRIGGER landing_page_short_link
AFTER INSERT OR UPDATE OF status ON public.smartops_form_landing_pages
FOR EACH ROW EXECUTE FUNCTION public.trg_landing_page_short_link();

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT DISTINCT f.slug
      FROM public.smartops_form_landing_pages lp
      JOIN public.smartops_forms f ON f.id = lp.form_id
     WHERE lp.status = 'published'
       AND f.slug IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM public.smartops_short_links sl
          WHERE sl.form_slug = f.slug AND sl.default_target = 'landing_page')
  LOOP
    PERFORM public.generate_short_link(r.slug, 'landing_page');
  END LOOP;
END $$;