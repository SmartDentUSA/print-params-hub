UPDATE public.smartops_form_landing_pages lp
SET content = jsonb_set(lp.content, '{sectionsEnabled}', coalesce(lp.content->'sectionsEnabled','{}'::jsonb) || '{"faq": false}'::jsonb), updated_at = now()
FROM public.smartops_forms f
WHERE f.id = lp.form_id AND f.slug IN ('dds-blz-ls100','impressora-3d-rayshape-edge-mini');