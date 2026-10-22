DO $migration$
DECLARE definition text; old_block text; new_block text;
BEGIN
  SELECT pg_get_functiondef('public.fn_form_metrics(integer)'::regprocedure) INTO definition;
  old_block := $old$  path_map AS (
    SELECT '/f/' || slug AS page_path, id AS form_id FROM f
    UNION ALL SELECT '/f/lp/' || slug, id FROM f
  ),
  pv_raw AS (
    SELECT pm.form_id, lpv.session_id, date_trunc('day', lpv.viewed_at)::date AS day
    FROM lead_page_views lpv JOIN path_map pm ON pm.page_path = lpv.page_path
    WHERE lpv.viewed_at >= (SELECT since FROM period)
  ),$old$;
  new_block := $new$  pv_raw AS (
    SELECT f.id AS form_id, lpv.session_id, date_trunc('day', lpv.viewed_at)::date AS day
    FROM lead_page_views lpv
    CROSS JOIN LATERAL (
      SELECT regexp_replace(split_part(split_part(regexp_replace(lpv.page_path,
        '^https?://(parametros\.|www\.|admin\.)?smartdent\.com\.br(?=/|$)', '', 'i'), '?', 1), '#', 1), '/+$', '') AS path
    ) normalized
    JOIN f ON (
      CASE WHEN lpv.extra_data->>'form_id' IS NOT NULL
        THEN lpv.extra_data->>'form_id' = f.id::text
        ELSE normalized.path IN ('/f/' || f.slug, '/f/lp/' || f.slug, '/lp/' || f.slug)
      END
    )
    WHERE lpv.viewed_at >= (SELECT since FROM period)
  ),$new$;
  IF position(old_block IN definition) = 0 THEN
    RAISE EXCEPTION 'Metrics definition changed; refusing to overwrite existing conversion logic';
  END IF;
  EXECUTE replace(definition, old_block, new_block);
END
$migration$;