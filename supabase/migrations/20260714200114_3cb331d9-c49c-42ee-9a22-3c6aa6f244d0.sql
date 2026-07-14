UPDATE public.system_a_catalog s
SET active = false,
    visible_in_ui = false,
    updated_at = now(),
    extra_data = COALESCE(extra_data, '{}'::jsonb)
                 || jsonb_build_object(
                      'deduped_at', to_jsonb(now()),
                      'deduped_reason', 'system_a_live import duplicate'
                    )
WHERE s.product_category = 'RESINAS 3D'
  AND (s.extra_data ? 'system_a_live')
  AND EXISTS (
    SELECT 1 FROM public.system_a_catalog s2
    WHERE s2.id <> s.id
      AND s2.product_category = 'RESINAS 3D'
      AND lower(trim(s2.name)) = lower(trim(s.name))
      AND s2.active AND s2.approved AND s2.visible_in_ui
      AND s2.created_at < s.created_at
  );