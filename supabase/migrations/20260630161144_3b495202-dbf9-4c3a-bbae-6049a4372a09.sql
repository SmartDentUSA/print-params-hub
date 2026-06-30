CREATE OR REPLACE FUNCTION public.apply_variation_specs(_sac_id uuid, _new_specs jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _xd jsonb;
  _existing jsonb;
  _kept jsonb;
  _final jsonb;
BEGIN
  SELECT COALESCE(extra_data,'{}'::jsonb) INTO _xd FROM public.system_a_catalog WHERE id = _sac_id;
  IF NOT FOUND THEN RETURN; END IF;
  _existing := COALESCE(_xd #> '{system_a_live,technical_specs}', '[]'::jsonb);
  SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb) INTO _kept
  FROM jsonb_array_elements(_existing) elem
  WHERE NOT (elem->>'label' ~ '^\s*(GTIN/EAN|Peso \(kg\)|Dimensões \(cm\))(\s*[—–-]\s*.+)?\s*$');
  _final := _kept || _new_specs;
  _xd := jsonb_set(_xd, '{system_a_live,technical_specs}', _final, true);
  _xd := jsonb_set(_xd, '{system_a_live,manually_edited_at}', to_jsonb(now()::text), true);
  UPDATE public.system_a_catalog
  SET extra_data = _xd,
      technical_specs = _final,
      technical_specs_en = NULL,
      technical_specs_es = NULL,
      updated_at = now()
  WHERE id = _sac_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_variation_specs(uuid, jsonb) TO service_role;