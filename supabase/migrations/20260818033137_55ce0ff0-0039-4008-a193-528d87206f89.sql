DO $mig$
DECLARE src text; new_src text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO src
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE p.proname='fn_lead_timeline_unified' AND n.nspname='public'
  LIMIT 1;

  new_src := replace(
    src,
    $q$COALESCE(NULLIF(v.page_title, ''), NULLIF(v.page_path, ''), 'Visita')$q$,
    $q$COALESCE(NULLIF(v.extra_data->>'content_title',''), NULLIF(v.page_title, ''), NULLIF(v.page_path, ''), 'Visita')$q$
  );

  new_src := replace(
    new_src,
    $q$CASE WHEN v.page_type ILIKE '%knowledge%' OR v.page_path ILIKE '%base-conhecimento%'$q$,
    $q$CASE WHEN v.page_type ILIKE '%knowledge%' OR v.page_type ILIKE 'kb!_%' ESCAPE '!' OR v.page_path ILIKE '%base-conhecimento%'$q$
  );

  new_src := replace(
    new_src,
    $q$'fonte', 'lead_page_views'$q$,
    $q$'fonte', 'lead_page_views',
        'action', v.extra_data->>'action',
        'content_type', v.extra_data->>'content_type',
        'content_slug', v.extra_data->>'content_slug'$q$
  );

  IF new_src = src THEN
    RAISE EXCEPTION 'fn_lead_timeline_unified patch failed: markers not found';
  END IF;

  EXECUTE new_src;
END $mig$;