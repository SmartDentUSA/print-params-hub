-- Recreate vw_vendas_ganhas to read from canonical JSONB piperun_deals_history
-- (same source as Copilot Brain). Tabela `deals` está defasada e perde eventos.

DROP VIEW IF EXISTS public.vw_vendas_ganhas CASCADE;

CREATE VIEW public.vw_vendas_ganhas AS
WITH exploded AS (
  SELECT
    la.id,
    snap->>'deal_id'        AS piperun_deal_id,
    snap->>'owner_name'     AS vendedor,
    snap->>'pipeline_name'  AS pipeline,
    snap->>'stage_name'     AS etapa,
    snap->>'product'        AS produto,
    NULL::text              AS categoria,
    NULLIF(snap->>'value','')::numeric          AS valor,
    NULLIF(snap->>'value_products','')::numeric AS valor_produtos,
    NULLIF(snap->>'value_freight','')::numeric  AS valor_frete,
    snap->>'payment_method'                     AS forma_pagamento,
    NULLIF(snap->>'payment_installments','')::int AS parcelas,
    snap->>'origin_name'    AS origem,
    CASE
      WHEN (snap->>'closed_at') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
        THEN (snap->>'closed_at')::timestamptz
      ELSE NULL
    END AS fechado_em,
    -- deterministic tiebreaker for DISTINCT ON
    COALESCE(NULLIF(snap->>'value','')::numeric, 0) AS _val_for_pick
  FROM public.lia_attendances la,
       LATERAL jsonb_array_elements(la.piperun_deals_history) snap
  WHERE la.merged_into IS NULL
    AND snap->>'status' = 'ganha'
    AND snap->>'deal_id' ~ '^[0-9]+$'
),
deduped AS (
  SELECT DISTINCT ON (piperun_deal_id) *
  FROM exploded
  WHERE fechado_em IS NOT NULL
  ORDER BY piperun_deal_id, _val_for_pick DESC, fechado_em DESC
)
SELECT
  id,
  piperun_deal_id,
  vendedor,
  pipeline,
  etapa,
  produto,
  categoria,
  valor,
  valor_produtos,
  valor_frete,
  forma_pagamento,
  parcelas,
  origem,
  fechado_em,
  date_trunc('month', fechado_em) AS mes_fechamento
FROM deduped;

GRANT SELECT ON public.vw_vendas_ganhas TO anon, authenticated, service_role;