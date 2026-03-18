
UPDATE lia_attendances SET piperun_deals_history = (
  SELECT jsonb_agg(
    CASE 
      WHEN deal ? 'proposals' AND jsonb_typeof(deal->'proposals') = 'array' THEN
        deal || jsonb_build_object('proposals', (
          SELECT COALESCE(jsonb_agg(
            CASE
              WHEN prop ? 'items' AND jsonb_typeof(prop->'items') = 'array' THEN
                prop || jsonb_build_object('items', (
                  SELECT COALESCE(jsonb_agg(
                    CASE
                      WHEN COALESCE(itm->>'nome', '') = '' THEN
                        itm || jsonb_build_object('nome', COALESCE(
                          (SELECT COALESCE(pd_item->>'product_name', pd_item->>'name', pd_item->'item'->>'name')
                           FROM jsonb_array_elements(proposals_data) pd,
                                jsonb_array_elements(CASE WHEN pd ? 'items' AND jsonb_typeof(pd->'items') = 'array' THEN pd->'items' ELSE '[]'::jsonb END) pd_item
                           WHERE (pd_item->>'id')::text = (itm->>'item_id')::text
                           LIMIT 1),
                          ''
                        ))
                      ELSE itm
                    END
                  ), '[]'::jsonb)
                  FROM jsonb_array_elements(prop->'items') itm
                ))
              ELSE prop
            END
          ), '[]'::jsonb)
          FROM jsonb_array_elements(deal->'proposals') prop
        ))
      ELSE deal
    END
  )
  FROM jsonb_array_elements(piperun_deals_history) deal
)
WHERE piperun_deals_history IS NOT NULL
  AND jsonb_typeof(piperun_deals_history) = 'array'
  AND jsonb_array_length(piperun_deals_history) > 0
  AND proposals_data IS NOT NULL
  AND jsonb_typeof(proposals_data) = 'array'
  AND jsonb_array_length(proposals_data) > 0
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(piperun_deals_history) d,
      jsonb_array_elements(CASE WHEN d ? 'proposals' AND jsonb_typeof(d->'proposals') = 'array' THEN d->'proposals' ELSE '[]'::jsonb END) p,
      jsonb_array_elements(CASE WHEN p ? 'items' AND jsonb_typeof(p->'items') = 'array' THEN p->'items' ELSE '[]'::jsonb END) i
    WHERE COALESCE(i->>'nome', '') = ''
  );
