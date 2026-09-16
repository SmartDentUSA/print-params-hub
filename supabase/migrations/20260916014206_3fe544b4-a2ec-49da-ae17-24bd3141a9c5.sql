ALTER TABLE public.smartops_forms
ADD COLUMN IF NOT EXISTS event_product_buttons jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.smartops_forms.event_product_buttons IS
'Até 3 botões de escolha única exibidos após os combos em formulários feira_evento. Cada item: {label, product_catalog_id, product_name}.';

CREATE OR REPLACE FUNCTION public.fn_validate_event_product_buttons()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  item jsonb;
BEGIN
  IF NEW.event_product_buttons IS NULL THEN
    NEW.event_product_buttons := '[]'::jsonb;
  END IF;

  IF jsonb_typeof(NEW.event_product_buttons) <> 'array' THEN
    RAISE EXCEPTION 'event_product_buttons deve ser uma lista';
  END IF;

  IF jsonb_array_length(NEW.event_product_buttons) > 3 THEN
    RAISE EXCEPTION 'event_product_buttons aceita no máximo 3 botões';
  END IF;

  FOR item IN SELECT value FROM jsonb_array_elements(NEW.event_product_buttons)
  LOOP
    IF jsonb_typeof(item) <> 'object'
       OR btrim(COALESCE(item->>'label', '')) = ''
       OR btrim(COALESCE(item->>'product_catalog_id', '')) = ''
       OR btrim(COALESCE(item->>'product_name', '')) = '' THEN
      RAISE EXCEPTION 'Cada botão precisa de label, product_catalog_id e product_name';
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_event_product_buttons ON public.smartops_forms;
CREATE TRIGGER trg_validate_event_product_buttons
BEFORE INSERT OR UPDATE OF event_product_buttons ON public.smartops_forms
FOR EACH ROW
EXECUTE FUNCTION public.fn_validate_event_product_buttons();