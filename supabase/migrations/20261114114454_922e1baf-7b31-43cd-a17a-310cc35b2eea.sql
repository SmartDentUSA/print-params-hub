ALTER TABLE public.social_scheduled_posts ADD COLUMN IF NOT EXISTS group_link_url text;

CREATE OR REPLACE FUNCTION public.fn_validate_group_link_url()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.group_link_url IS NOT NULL THEN
    NEW.group_link_url := nullif(btrim(NEW.group_link_url), '');
    IF NEW.group_link_url IS NOT NULL AND NEW.group_link_url !~* '^https?://[^\s]+$' THEN
      RAISE EXCEPTION 'Link para os grupos inválido: use um endereço http(s) sem espaços';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_validate_group_link_url ON public.social_scheduled_posts;
CREATE TRIGGER trg_validate_group_link_url
BEFORE INSERT OR UPDATE OF group_link_url ON public.social_scheduled_posts
FOR EACH ROW EXECUTE FUNCTION public.fn_validate_group_link_url();