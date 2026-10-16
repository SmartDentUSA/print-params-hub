CREATE OR REPLACE FUNCTION public.fn_kol_form_coupons(_form_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _fname text;
  _pname text;
  _lead record;
  _coupons jsonb;
BEGIN
  SELECT name INTO _fname FROM public.smartops_forms WHERE id = _form_id;
  IF _fname IS NULL OR _fname !~* 'indica' THEN
    RETURN NULL;
  END IF;

  _pname := trim(regexp_replace(_fname, '^#?\s*-?\s*INDICA[ÇC][ÃA]O\s*-?\s*', '', 'i'));

  SELECT l.id,
         COALESCE(NULLIF(l.prof_display_name, ''), l.nome) AS pname,
         COALESCE(l.prof_kol_coupons, '[]'::jsonb) AS kc
    INTO _lead
    FROM public.lia_attendances l
   WHERE l.merged_into IS NULL
     AND l.archived_at IS NULL
     AND l.prof_kol_coupons IS NOT NULL
     AND l.prof_kol_coupons <> '[]'::jsonb
     AND (
       SELECT bool_and(lower(COALESCE(NULLIF(l.prof_display_name, ''), l.nome)) LIKE '%' || lower(t) || '%')
       FROM unnest(string_to_array(_pname, ' ')) AS t
     )
   ORDER BY l.created_at
   LIMIT 1;

  IF _lead.id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(jsonb_agg(c ORDER BY c->>'code'), '[]'::jsonb) INTO _coupons
    FROM (
      SELECT jsonb_build_object(
        'code', pc.code,
        'discount_type', pc.discount_type,
        'discount_value', pc.discount_value,
        'free_shipping', COALESCE(pc.free_shipping, false) OR pc.kind = 'freight',
        'valid_until', pc.valid_until,
        'categories', COALESCE(pt.coupon_li_category_labels, '[]'::jsonb),
        'category', kc.c->>'category',
        'subcategory', kc.c->>'subcategory'
      ) AS c
      FROM public.promotional_coupons pc
      JOIN public.promotional_tables pt ON pt.id = pc.promotional_table_id
      LEFT JOIN LATERAL (
        SELECT c FROM jsonb_array_elements(_lead.kc) c
        WHERE upper(c->>'code') = upper(pc.code)
      ) kc ON true
      WHERE pt.professional_lead_id = _lead.id
        AND pc.active
        AND (pc.valid_until IS NULL OR pc.valid_until >= now()::date)
    ) s;

  IF _coupons = '[]'::jsonb THEN
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'code', c->>'code',
        'discount_type', 'percent',
        'discount_value', NULL,
        'free_shipping', false,
        'valid_until', c->>'active_to',
        'categories', '[]'::jsonb,
        'category', c->>'category',
        'subcategory', c->>'subcategory'
      ) ORDER BY c->>'code'
    ), '[]'::jsonb)
      INTO _coupons
      FROM jsonb_array_elements(_lead.kc) c
     WHERE NULLIF(c->>'active_to', '') IS NOT NULL
       AND (c->>'active_to')::date >= now()::date;
  END IF;

  RETURN jsonb_build_object('professional_name', _lead.pname, 'coupons', _coupons);
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_kol_form_coupons(uuid) TO anon, authenticated;