UPDATE public.smartops_form_landing_pages lp
SET content = jsonb_set(
  jsonb_set(lp.content, '{sectionsEnabled}', coalesce(lp.content->'sectionsEnabled','{}'::jsonb) || '{"modules": false}'::jsonb),
  '{faq,items}',
  coalesce((SELECT jsonb_agg(i) FROM jsonb_array_elements(lp.content->'faq'->'items') i
            WHERE i::text !~* '(\mRMS\M|Ultimate|Lab Bundle|my\.exocad|DentalCAD|licen[cç]a oficial|assinatura)'), '[]'::jsonb)
), updated_at = now()
FROM public.smartops_forms f
WHERE f.id = lp.form_id
  AND f.slug IN ('blz-dental-dmc','dds-blz-ls100','impressora-3d-rayshape-edge-mini');