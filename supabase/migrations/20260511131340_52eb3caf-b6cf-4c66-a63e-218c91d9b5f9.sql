CREATE OR REPLACE FUNCTION public.protect_origem_primeiro_contato()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Preserve real campaign-name origin once set; allow overwriting channel-junk values.
  IF OLD.origem_primeiro_contato IS NOT NULL
     AND lower(OLD.origem_primeiro_contato) NOT IN ('piperun','sellflux','sync','crm','manual_capture','meta','meta_lead_ads','form','formulário')
  THEN
    NEW.origem_primeiro_contato := OLD.origem_primeiro_contato;
  END IF;
  RETURN NEW;
END;
$$;