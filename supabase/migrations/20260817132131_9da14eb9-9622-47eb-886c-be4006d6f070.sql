UPDATE public.smartops_forms f
SET bio_enabled_form = true
WHERE EXISTS (SELECT 1 FROM public.smartops_short_links l WHERE l.form_slug = f.slug AND l.default_target = 'form');

UPDATE public.smartops_forms f
SET bio_enabled_landing = true
WHERE EXISTS (SELECT 1 FROM public.smartops_short_links l WHERE l.form_slug = f.slug AND l.default_target = 'landing_page');