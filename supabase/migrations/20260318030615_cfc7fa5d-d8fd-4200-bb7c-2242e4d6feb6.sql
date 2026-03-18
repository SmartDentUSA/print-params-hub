
-- Backfill: reconstruct proposal items in piperun_deals_history from proposals_data
-- proposals_data has the original PipeRun data with name, value, quantity
CREATE OR REPLACE FUNCTION public.fn_backfill_proposal_items()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_count integer := 0;
  v_lead RECORD;
  v_new_deals jsonb;
  v_deal jsonb;
  v_new_proposals jsonb;
  v_prop jsonb;
  v_new_items jsonb;
  v_pd_prop jsonb;
  v_pd_item jsonb;
  v_nome text;
BEGIN
  FOR v_lead IN
    SELECT id, piperun_deals_history, proposals_data
    FROM lia_attendances
    WHERE piperun_deals_history IS NOT NULL
      AND jsonb_typeof(piperun_deals_history) = 'array'
      AND jsonb_array_length(piperun_deals_history) > 0
      AND proposals_data IS NOT NULL
      AND jsonb_typeof(proposals_data) = 'array'
      AND jsonb_array_length(proposals_data) > 0
  LOOP
    v_new_deals := '[]'::jsonb;
    
    FOR v_deal IN SELECT value FROM jsonb_array_elements(v_lead.piperun_deals_history)
    LOOP
      -- Check if this deal has proposals with empty items
      IF v_deal->'proposals' IS NOT NULL AND jsonb_typeof(v_deal->'proposals') = 'array' THEN
        v_new_proposals := '[]'::jsonb;
        
        FOR v_prop IN SELECT value FROM jsonb_array_elements(v_deal->'proposals')
        LOOP
          -- If items is empty or missing, try to fill from proposals_data
          IF v_prop->'items' IS NULL 
             OR jsonb_typeof(v_prop->'items') != 'array' 
             OR jsonb_array_length(v_prop->'items') = 0 THEN
            
            -- Find matching proposal in proposals_data by id
            v_new_items := '[]'::jsonb;
            FOR v_pd_prop IN SELECT value FROM jsonb_array_elements(v_lead.proposals_data)
            LOOP
              -- Match by proposal id (comparing as text)
              IF COALESCE(v_pd_prop->>'id','') = COALESCE(v_prop->>'id','')
                 OR (v_pd_prop->>'id' IS NULL AND v_prop->>'id' IS NULL) THEN
                -- Extract items from proposals_data
                IF v_pd_prop->'items' IS NOT NULL AND jsonb_typeof(v_pd_prop->'items') = 'array' THEN
                  FOR v_pd_item IN SELECT value FROM jsonb_array_elements(v_pd_prop->'items')
                  LOOP
                    v_nome := COALESCE(v_pd_item->>'name', '');
                    -- Strip HTML from name
                    v_nome := regexp_replace(v_nome, '<[^>]*>', '', 'g');
                    v_nome := replace(v_nome, '&nbsp;', ' ');
                    v_nome := replace(v_nome, '&amp;', '&');
                    v_nome := trim(v_nome);
                    
                    -- Skip truly empty items (no name AND no value)
                    IF v_nome = '' AND COALESCE((v_pd_item->>'value')::numeric, 0) = 0 THEN
                      CONTINUE;
                    END IF;
                    
                    v_new_items := v_new_items || jsonb_build_array(jsonb_build_object(
                      'item_id', COALESCE(v_pd_item->>'id', ''),
                      'nome', v_nome,
                      'tipo', COALESCE(v_pd_item->>'type', 'Produto'),
                      'qtd', COALESCE((v_pd_item->>'quantity')::numeric, 1),
                      'unit', COALESCE((v_pd_item->>'value')::numeric, 0),
                      'total', COALESCE((v_pd_item->>'value')::numeric, 0) * COALESCE((v_pd_item->>'quantity')::numeric, 1),
                      'categoria', COALESCE(v_pd_item->>'category', '')
                    ));
                  END LOOP;
                END IF;
              END IF;
            END LOOP;
            
            -- If we found items from proposals_data, use them; otherwise keep original
            IF jsonb_array_length(v_new_items) > 0 THEN
              v_new_proposals := v_new_proposals || jsonb_build_array(jsonb_set(v_prop, '{items}', v_new_items));
            ELSE
              v_new_proposals := v_new_proposals || jsonb_build_array(v_prop);
            END IF;
          ELSE
            -- Items already exist, but fix unit/total if they are 0 and proposals_data has values
            v_new_proposals := v_new_proposals || jsonb_build_array(v_prop);
          END IF;
        END LOOP;
        
        v_new_deals := v_new_deals || jsonb_build_array(jsonb_set(v_deal, '{proposals}', v_new_proposals));
      ELSE
        v_new_deals := v_new_deals || jsonb_build_array(v_deal);
      END IF;
    END LOOP;
    
    -- Only update if something changed
    IF v_new_deals != v_lead.piperun_deals_history THEN
      UPDATE lia_attendances SET piperun_deals_history = v_new_deals WHERE id = v_lead.id;
      v_count := v_count + 1;
    END IF;
  END LOOP;
  
  RETURN v_count;
END;
$$;

SELECT fn_backfill_proposal_items();

DROP FUNCTION IF EXISTS fn_backfill_proposal_items();
