CREATE OR REPLACE FUNCTION public.fn_owner_purchase_history(_lead_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _historico jsonb; _ciclos numeric[];
  _ciclo_medio numeric; _ciclo_mediano numeric;
  _total_deals int; _receita_total numeric;
  _lead_nome text; _aviso text;
BEGIN
  SELECT nome INTO _lead_nome FROM lia_attendances
  WHERE id = _lead_id AND merged_into IS NULL LIMIT 1;

  IF _lead_nome IS NULL THEN
    RETURN jsonb_build_object(
      '_source','fn_owner_purchase_history','_row_count',0,
      '_empty_message','Lead não encontrado ou foi mesclado a outro canônico.',
      'historico','[]'::jsonb,'ciclos_dias','[]'::jsonb,
      'ciclo_medio_dias',NULL,'ciclo_mediano_dias',NULL,
      'total_deals',0,'receita_total',0);
  END IF;

  WITH d AS (
    SELECT d.id, d.piperun_deal_id, d.stage_name, d.value,
      COALESCE(d.closed_at, d.piperun_created_at, d.created_at) AS data_evento,
      (SELECT jsonb_agg(jsonb_build_object(
          'produto', COALESCE(di.product_name, di.nome_produto),
          'qtd', COALESCE(di.quantity, di.quantidade),
          'valor', COALESCE(di.total_value, di.valor_total))
        ORDER BY COALESCE(di.product_name, di.nome_produto))
       FROM deal_items di
       WHERE di.deal_id = d.piperun_deal_id) AS itens
    FROM deals d
    WHERE d.lead_id = _lead_id AND d.status='ganha'
      AND COALESCE(d.is_deleted,false)=false
  )
  SELECT
    COALESCE(jsonb_agg(jsonb_build_object(
      'deal_id', id, 'piperun_deal_id', piperun_deal_id,
      'data', data_evento, 'valor', value, 'stage', stage_name,
      'itens', COALESCE(itens,'[]'::jsonb)) ORDER BY data_evento),'[]'::jsonb),
    COUNT(*), COALESCE(SUM(value),0)
  INTO _historico, _total_deals, _receita_total FROM d;

  IF _total_deals >= 2 THEN
    WITH d AS (
      SELECT COALESCE(d.closed_at, d.piperun_created_at, d.created_at) AS data_evento
      FROM deals d
      WHERE d.lead_id=_lead_id AND d.status='ganha'
        AND COALESCE(d.is_deleted,false)=false),
    diffs AS (
      SELECT EXTRACT(EPOCH FROM (data_evento - LAG(data_evento) OVER (ORDER BY data_evento)))/86400.0 AS dias
      FROM d)
    SELECT
      array_agg(ROUND(dias::numeric,1)) FILTER (WHERE dias IS NOT NULL),
      ROUND(AVG(dias)::numeric,1),
      ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY dias)::numeric,1)
    INTO _ciclos, _ciclo_medio, _ciclo_mediano FROM diffs;
    _aviso := NULL;
  ELSE
    _ciclos := ARRAY[]::numeric[];
    _ciclo_medio := NULL; _ciclo_mediano := NULL;
    _aviso := 'Sem dados suficientes para calcular ciclo (apenas '||_total_deals||' compra registrada).';
  END IF;

  RETURN jsonb_build_object(
    '_source','fn_owner_purchase_history (PipeRun deals where status=ganha)',
    '_row_count', _total_deals,
    '_empty_message', CASE WHEN _total_deals=0 THEN 'Lead não possui deals ganhos no PipeRun.' ELSE NULL END,
    '_disclaimer', _aviso,
    'lead_id', _lead_id, 'lead_nome', _lead_nome,
    'total_deals', _total_deals, 'receita_total', _receita_total,
    'historico', _historico,
    'ciclos_dias', to_jsonb(_ciclos),
    'ciclo_medio_dias', _ciclo_medio,
    'ciclo_mediano_dias', _ciclo_mediano);
END;
$$;