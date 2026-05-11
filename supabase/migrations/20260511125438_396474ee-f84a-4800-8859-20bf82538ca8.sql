ALTER TABLE public.lia_attendances ADD COLUMN IF NOT EXISTS origem_primeiro_contato text;

UPDATE public.lia_attendances
SET origem_primeiro_contato = COALESCE(origem_campanha, form_name, source)
WHERE origem_primeiro_contato IS NULL;

CREATE OR REPLACE FUNCTION public.protect_origem_primeiro_contato()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.origem_primeiro_contato IS NOT NULL
     AND OLD.origem_primeiro_contato <> ''
     AND NEW.origem_primeiro_contato IS DISTINCT FROM OLD.origem_primeiro_contato THEN
    NEW.origem_primeiro_contato := OLD.origem_primeiro_contato;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_origem_primeiro_contato ON public.lia_attendances;
CREATE TRIGGER trg_protect_origem_primeiro_contato
BEFORE UPDATE ON public.lia_attendances
FOR EACH ROW
EXECUTE FUNCTION public.protect_origem_primeiro_contato();