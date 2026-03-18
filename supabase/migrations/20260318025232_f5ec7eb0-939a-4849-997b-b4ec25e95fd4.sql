
CREATE OR REPLACE FUNCTION public.fn_clean_proposal_html()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_count integer := 0;
  v_lead RECORD;
  v_deal_elem jsonb;
  v_prop_elem jsonb;
  v_item_elem jsonb;
  v_new_deals jsonb;
  v_new_proposals jsonb;
  v_new_items jsonb;
  v_nome text;
  v_clean_nome text;
BEGIN
  FOR v_lead IN
    SELECT id, piperun_deals_history
    FROM lia_attendances
    WHERE piperun_deals_history IS NOT NULL
      AND jsonb_typeof(piperun_deals_history) = 'array'
      AND jsonb_array_length(piperun_deals_history) > 0
      AND piperun_deals_history::text LIKE '%<%>%'
  LOOP
    v_new_deals := '[]'::jsonb;
    
    FOR v_deal_elem IN SELECT value FROM jsonb_array_elements(v_lead.piperun_deals_history)
    LOOP
      IF v_deal_elem->'proposals' IS NOT NULL AND jsonb_typeof(v_deal_elem->'proposals') = 'array' THEN
        v_new_proposals := '[]'::jsonb;
        
        FOR v_prop_elem IN SELECT value FROM jsonb_array_elements(v_deal_elem->'proposals')
        LOOP
          IF v_prop_elem->'items' IS NOT NULL AND jsonb_typeof(v_prop_elem->'items') = 'array' THEN
            v_new_items := '[]'::jsonb;
            
            FOR v_item_elem IN SELECT value FROM jsonb_array_elements(v_prop_elem->'items')
            LOOP
              v_nome := COALESCE(v_item_elem->>'nome', '');
              v_clean_nome := regexp_replace(v_nome, '<[^>]*>', '', 'g');
              v_clean_nome := replace(v_clean_nome, '&nbsp;', ' ');
              v_clean_nome := replace(v_clean_nome, '&amp;', '&');
              v_clean_nome := trim(v_clean_nome);
              
              IF v_clean_nome = '' AND COALESCE((v_item_elem->>'total')::numeric, 0) = 0 AND COALESCE((v_item_elem->>'unit')::numeric, 0) = 0 THEN
                CONTINUE;
              END IF;
              
              v_new_items := v_new_items || jsonb_build_array(
                v_item_elem || jsonb_build_object('nome', v_clean_nome)
              );
            END LOOP;
            
            v_new_proposals := v_new_proposals || jsonb_build_array(
              jsonb_set(v_prop_elem, '{items}', v_new_items)
            );
          ELSE
            v_new_proposals := v_new_proposals || jsonb_build_array(v_prop_elem);
          END IF;
        END LOOP;
        
        v_new_deals := v_new_deals || jsonb_build_array(
          jsonb_set(v_deal_elem, '{proposals}', v_new_proposals)
        );
      ELSE
        v_new_deals := v_new_deals || jsonb_build_array(v_deal_elem);
      END IF;
    END LOOP;
    
    UPDATE lia_attendances SET piperun_deals_history = v_new_deals WHERE id = v_lead.id;
    v_count := v_count + 1;
  END LOOP;
  
  RETURN v_count;
END;
$$;

SELECT fn_clean_proposal_html();

DROP FUNCTION IF EXISTS fn_clean_proposal_html();
