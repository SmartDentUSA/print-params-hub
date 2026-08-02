CREATE OR REPLACE FUNCTION public.fn_autoregister_product_taxonomy()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.product_key IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.product_taxonomy t WHERE t.product_key = NEW.product_key) THEN
    INSERT INTO public.product_taxonomy (product_key, display_name, workflow_stage, is_smartdent, is_competitor)
    VALUES (
      NEW.product_key,
      COALESCE(NULLIF(NEW.product_name, ''), NEW.product_key),
      NEW.workflow_stage,
      true,
      false
    )
    ON CONFLICT (product_key) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_autoregister_product_taxonomy ON public.lead_opportunities;
CREATE TRIGGER trg_autoregister_product_taxonomy
BEFORE INSERT OR UPDATE OF product_key ON public.lead_opportunities
FOR EACH ROW EXECUTE FUNCTION public.fn_autoregister_product_taxonomy();