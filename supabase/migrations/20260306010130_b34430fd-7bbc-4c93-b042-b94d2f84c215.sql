CREATE OR REPLACE FUNCTION public.trigger_recalculate_intelligence_score()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF (
    OLD.urgency_level IS DISTINCT FROM NEW.urgency_level OR
    OLD.interest_timeline IS DISTINCT FROM NEW.interest_timeline OR
    OLD.total_messages IS DISTINCT FROM NEW.total_messages OR
    OLD.total_sessions IS DISTINCT FROM NEW.total_sessions OR
    OLD.confidence_score_analysis IS DISTINCT FROM NEW.confidence_score_analysis OR
    OLD.proposals_total_value IS DISTINCT FROM NEW.proposals_total_value OR
    OLD.lojaintegrada_ultimo_pedido_valor IS DISTINCT FROM NEW.lojaintegrada_ultimo_pedido_valor OR
    OLD.tem_impressora IS DISTINCT FROM NEW.tem_impressora OR
    OLD.tem_scanner IS DISTINCT FROM NEW.tem_scanner
  ) THEN
    PERFORM calculate_lead_intelligence_score(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_recalc_intelligence_score
  AFTER UPDATE ON lia_attendances
  FOR EACH ROW
  EXECUTE FUNCTION trigger_recalculate_intelligence_score();