CREATE OR REPLACE FUNCTION public.fn_product_owners(_busca text)
RETURNS TABLE (
  lead_id uuid,
  nome text,
  email text,
  telefone text,
  cidade text,
  uf text,
  data_primeira_compra date,
  data_ultima_compra date,
  qtd_unidades numeric,
  receita_total numeric,
  n_deals bigint,
  data_ultima_compra_insumos date,
  dias_desde_insumo integer,
  status_recompra text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH owners AS (
    SELECT
      d.lead_id,
      MIN(d.closed_at)::date AS data_primeira_compra,
      MAX(d.closed_at)::date AS data_ultima_compra,
      SUM(COALESCE(di.quantity, di.quantidade, 1)) AS qtd_unidades,
      SUM(COALESCE(di.total_value, di.valor_total, 0)) AS receita_total,
      COUNT(DISTINCT d.id) AS n_deals
    FROM deals d
    JOIN deal_items di ON di.deal_id = d.piperun_deal_id
    WHERE d.status = 'ganha'
      AND d.lead_id IS NOT NULL
      AND (
        di.product_name ILIKE '%' || _busca || '%'
        OR di.nome_produto ILIKE '%' || _busca || '%'
      )
    GROUP BY d.lead_id
  )
  SELECT
    o.lead_id,
    la.nome,
    la.email,
    la.telefone_normalized AS telefone,
    la.cidade,
    la.uf,
    o.data_primeira_compra,
    o.data_ultima_compra,
    o.qtd_unidades,
    o.receita_total,
    o.n_deals,
    la.data_ultima_compra_insumos::date AS data_ultima_compra_insumos,
    CASE WHEN la.data_ultima_compra_insumos IS NOT NULL
      THEN (CURRENT_DATE - la.data_ultima_compra_insumos::date)
      ELSE NULL
    END AS dias_desde_insumo,
    CASE
      WHEN la.data_ultima_compra_insumos IS NULL THEN 'sem_recompra'
      WHEN (CURRENT_DATE - la.data_ultima_compra_insumos::date) <= 45 THEN 'ativo'
      WHEN (CURRENT_DATE - la.data_ultima_compra_insumos::date) <= 90 THEN 'alerta'
      ELSE 'inativo'
    END AS status_recompra
  FROM owners o
  LEFT JOIN lia_attendances la ON la.id = o.lead_id AND la.merged_into IS NULL
  ORDER BY o.data_primeira_compra DESC NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION public.fn_product_owners(text) TO anon, authenticated, service_role;