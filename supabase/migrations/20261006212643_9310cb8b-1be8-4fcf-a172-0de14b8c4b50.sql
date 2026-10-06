CREATE OR REPLACE FUNCTION public.fn_deal_items_normalize_tipo_frete()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v text;
BEGIN
  IF NEW.tipo_frete IS NOT NULL THEN
    v := upper(NEW.tipo_frete);
    NEW.tipo_frete := CASE
      WHEN v LIKE '%FOB%' THEN 'FOB'
      WHEN v LIKE '%CIF%' THEN 'CIF'
      WHEN v LIKE '%FRANCO%' THEN 'FRANCO'
      ELSE NULL END;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_deal_items_normalize_tipo_frete ON public.deal_items;
CREATE TRIGGER trg_deal_items_normalize_tipo_frete
BEFORE INSERT OR UPDATE OF tipo_frete ON public.deal_items
FOR EACH ROW EXECUTE FUNCTION public.fn_deal_items_normalize_tipo_frete();