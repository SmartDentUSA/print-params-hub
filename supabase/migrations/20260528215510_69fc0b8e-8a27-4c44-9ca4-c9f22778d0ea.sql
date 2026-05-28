-- Safety-net: garante consistência quando o último snapshot do histórico de deals
-- indica vitória (ganha/ganho/won/1) mas o lead ainda não foi marcado como
-- CLIENTE_ativo. Reflete a regra do webhook PipeRun em nível de banco.

CREATE OR REPLACE FUNCTION public.tg_lia_sync_won_from_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  last_snap jsonb;
  snap_status text;
  snap_value numeric;
  snap_closed text;
BEGIN
  -- Só age quando o histórico mudou e existe pelo menos 1 snapshot
  IF NEW.piperun_deals_history IS NULL
     OR jsonb_typeof(NEW.piperun_deals_history) <> 'array'
     OR jsonb_array_length(NEW.piperun_deals_history) = 0 THEN
    RETURN NEW;
  END IF;

  -- Lead consolidado (merged) não deve ser alterado
  IF NEW.merged_into IS NOT NULL THEN
    RETURN NEW;
  END IF;

  last_snap := NEW.piperun_deals_history -> (jsonb_array_length(NEW.piperun_deals_history) - 1);
  snap_status := lower(coalesce(last_snap ->> 'status', ''));

  IF snap_status IN ('ganha', 'ganho', 'won', '1') THEN
    IF NEW.lead_status IS DISTINCT FROM 'CLIENTE_ativo' THEN
      NEW.lead_status := 'CLIENTE_ativo';
    END IF;
    IF NEW.status_oportunidade IS DISTINCT FROM 'ganha' THEN
      NEW.status_oportunidade := 'ganha';
    END IF;
    NEW.piperun_status := 1;

    snap_value := NULLIF(last_snap ->> 'value', '')::numeric;
    IF NEW.valor_oportunidade IS NULL AND snap_value IS NOT NULL THEN
      NEW.valor_oportunidade := snap_value;
    END IF;

    snap_closed := last_snap ->> 'closed_at';
    IF NEW.data_fechamento_crm IS NULL AND snap_closed IS NOT NULL AND snap_closed <> '' THEN
      BEGIN
        NEW.data_fechamento_crm := snap_closed::timestamptz;
      EXCEPTION WHEN others THEN
        NULL;
      END;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_lia_sync_won_from_history ON public.lia_attendances;

CREATE TRIGGER tg_lia_sync_won_from_history
BEFORE UPDATE OF piperun_deals_history ON public.lia_attendances
FOR EACH ROW
EXECUTE FUNCTION public.tg_lia_sync_won_from_history();

COMMENT ON FUNCTION public.tg_lia_sync_won_from_history() IS
'Safety-net: força lead_status=CLIENTE_ativo + status_oportunidade=ganha + valor_oportunidade
quando o último snapshot de piperun_deals_history indica vitória (ganha/ganho/won/1).
Cobre o bug histórico em que o webhook PipeRun não reconhecia o status PT-BR.';