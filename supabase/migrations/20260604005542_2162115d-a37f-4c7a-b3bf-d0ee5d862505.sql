DO $$
DECLARE
  v_form record;
  v_map jsonb;
BEGIN
  FOR v_form IN
    SELECT id FROM smartops_forms WHERE name LIKE '# - FORMS - %'
  LOOP
    SELECT jsonb_object_agg(tpl.id::text, clone.id::text) INTO v_map
    FROM smartops_form_fields tpl
    JOIN smartops_form_fields clone
      ON clone.form_id = v_form.id
     AND clone.order_index = tpl.order_index
    WHERE tpl.form_id = '63ecb106-c297-46de-b8d3-77f94a9c0e5f';

    IF v_map IS NULL THEN CONTINUE; END IF;

    UPDATE smartops_form_fields f
    SET conditions = jsonb_build_object(
      'show_if', jsonb_build_object(
        'logic', COALESCE(f.conditions->'show_if'->>'logic', 'AND'),
        'rules', (
          SELECT jsonb_agg(
            CASE
              WHEN v_map ? (rule->>'field_id')
                THEN jsonb_set(rule, '{field_id}', to_jsonb(v_map->>(rule->>'field_id')))
              ELSE rule
            END
          )
          FROM jsonb_array_elements(f.conditions->'show_if'->'rules') AS rule
        )
      )
    )
    WHERE f.form_id = v_form.id
      AND f.conditions ? 'show_if'
      AND jsonb_typeof(f.conditions->'show_if'->'rules') = 'array';
  END LOOP;
END $$;