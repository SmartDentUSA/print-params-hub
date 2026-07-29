CREATE OR REPLACE FUNCTION public.fn_safe_date(p_text text)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE v date;
BEGIN
  IF p_text IS NULL OR btrim(p_text) = '' THEN RETURN NULL; END IF;
  BEGIN
    IF p_text ~ '^\d{1,2}/\d{1,2}/\d{4}' THEN
      v := to_date(substr(btrim(p_text),1,10), 'DD/MM/YYYY');
    ELSE
      v := (btrim(p_text))::date;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;
  RETURN v;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_safe_date(text) TO authenticated, service_role, anon;

CREATE INDEX IF NOT EXISTS idx_shl_fn_error_created
  ON public.system_health_logs (function_name, error_type, created_at DESC);