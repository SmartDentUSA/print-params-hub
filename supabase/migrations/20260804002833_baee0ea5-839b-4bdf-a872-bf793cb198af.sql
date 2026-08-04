CREATE OR REPLACE FUNCTION public.fn_sanitize_lead_email()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_raw text;
  v_valids text[];
BEGIN
  IF NEW.email IS NULL THEN
    RETURN NEW;
  END IF;

  v_raw := btrim(NEW.email);
  IF v_raw = '' THEN
    NEW.email := NULL;
    RETURN NEW;
  END IF;

  -- Já é um e-mail único e válido (e não placeholder): apenas normaliza.
  IF v_raw ~* '^[^@[:space:],;]+@[^@[:space:],;]+\.[a-z]{2,}$'
     AND v_raw !~* '(@example\.com|@test\.com|@teste\.com|@placeholder|@unknown|@whatsapp\.lead|@lid)$' THEN
    NEW.email := lower(v_raw);
    RETURN NEW;
  END IF;

  -- Extrai todos os e-mails válidos do campo (listas separadas por , ; / | espaço)
  SELECT array_agg(lower(t) ORDER BY ord)
    INTO v_valids
    FROM unnest(regexp_split_to_array(v_raw, '[,;/|[:space:]]+')) WITH ORDINALITY AS u(t, ord)
   WHERE lower(t) ~ '^[^@[:space:],;]+@[^@[:space:],;]+\.[a-z]{2,}$'
     AND lower(t) !~ '(@example\.com|@test\.com|@teste\.com|@placeholder|@unknown|@whatsapp\.lead|@lid)$';

  -- Nada aproveitável: preserva o bruto, libera o campo canônico.
  IF v_valids IS NULL OR array_length(v_valids, 1) = 0 THEN
    NEW.email_invalido_raw := COALESCE(NEW.email_invalido_raw, v_raw);
    NEW.email := NULL;
    RETURN NEW;
  END IF;

  NEW.email := v_valids[1];
  IF array_length(v_valids, 1) > 1 THEN
    NEW.email_secundarios := (
      SELECT array_agg(DISTINCT e)
        FROM unnest(COALESCE(NEW.email_secundarios, '{}'::text[]) || v_valids[2:]) AS e
    );
  END IF;
  IF v_raw <> v_valids[1] THEN
    NEW.email_invalido_raw := COALESCE(NEW.email_invalido_raw, v_raw);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sanitize_lead_email ON public.lia_attendances;
CREATE TRIGGER trg_sanitize_lead_email
  BEFORE INSERT OR UPDATE OF email ON public.lia_attendances
  FOR EACH ROW EXECUTE FUNCTION public.fn_sanitize_lead_email();