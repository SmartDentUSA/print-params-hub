
CREATE OR REPLACE FUNCTION fn_recalc_ltv_from_deals()
RETURNS trigger AS $$
DECLARE
  v_ltv numeric := 0;
  v_count integer := 0;
  v_anchor text := null;
BEGIN
  IF NEW.piperun_deals_history IS NOT NULL 
     AND jsonb_typeof(NEW.piperun_deals_history) = 'array'
     AND jsonb_array_length(NEW.piperun_deals_history) > 0 THEN
    
    SELECT COALESCE(SUM((d->>'value')::numeric), 0),
           COUNT(*)
    INTO v_ltv, v_count
    FROM jsonb_array_elements(NEW.piperun_deals_history) d;
    
    SELECT d->>'product' INTO v_anchor
    FROM jsonb_array_elements(NEW.piperun_deals_history) d
    WHERE d->>'product' IS NOT NULL AND d->>'product' != ''
    GROUP BY d->>'product'
    ORDER BY COUNT(*) DESC, MAX(COALESCE((d->>'value')::numeric, 0)) DESC
    LIMIT 1;
  END IF;
  
  NEW.ltv_total := v_ltv;
  NEW.total_deals := v_count;
  NEW.anchor_product := v_anchor;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_recalc_ltv_from_deals ON lia_attendances;

CREATE TRIGGER trg_recalc_ltv_from_deals
  BEFORE INSERT OR UPDATE OF piperun_deals_history
  ON lia_attendances
  FOR EACH ROW
  EXECUTE FUNCTION fn_recalc_ltv_from_deals();
