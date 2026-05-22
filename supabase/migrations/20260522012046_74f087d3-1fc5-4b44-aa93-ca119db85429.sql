DROP FUNCTION IF EXISTS public.fn_product_owners(text);

CREATE FUNCTION public.fn_product_owners(_busca text)
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
  n_nfs bigint,
  fonte text,
  data_ultima_compra_insumos date,
  dias_desde_insumo integer,
  status_recompra text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH piperun AS (
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
      AND (di.product_name ILIKE '%' || _busca || '%' OR di.nome_produto ILIKE '%' || _busca || '%')
    GROUP BY d.lead_id
  ),
  omie AS (
    SELECT
      n.lead_id,
      MIN(n.data_emissao)::date AS data_primeira_compra,
      MAX(n.data_emissao)::date AS data_ultima_compra,
      SUM(COALESCE(i.quantidade, 1)) AS qtd_unidades,
      SUM(COALESCE(i.valor_total, 0)) AS receita_total,
      COUNT(DISTINCT n.id) AS n_nfs
    FROM omie_nf_items i
    JOIN omie_notas_fiscais n ON n.id = i.nf_id
    WHERE COALESCE(n.nf_direcao, 'saida') = 'saida'
      AND n.lead_id IS NOT NULL
      AND (i.produto_nome ILIKE '%' || _busca || '%' OR i.produto_alias ILIKE '%' || _busca || '%')
    GROUP BY n.lead_id
  ),
  joined AS (
    SELECT
      COALESCE(p.lead_id, o.lead_id) AS lead_id,
      LEAST(p.data_primeira_compra, o.data_primeira_compra) AS data_primeira_compra,
      GREATEST(p.data_ultima_compra, o.data_ultima_compra) AS data_ultima_compra,
      GREATEST(COALESCE(p.qtd_unidades, 0), COALESCE(o.qtd_unidades, 0)) AS qtd_unidades,
      GREATEST(COALESCE(p.receita_total, 0), COALESCE(o.receita_total, 0)) AS receita_total,
      COALESCE(p.n_deals, 0) AS n_deals,
      COALESCE(o.n_nfs, 0) AS n_nfs,
      CASE WHEN p.lead_id IS NOT NULL AND o.lead_id IS NOT NULL THEN 'piperun+omie'
           WHEN p.lead_id IS NOT NULL THEN 'piperun'
           ELSE 'omie' END AS fonte
    FROM piperun p
    FULL OUTER JOIN omie o ON o.lead_id = p.lead_id
  )
  SELECT
    j.lead_id,
    la.nome,
    la.email,
    la.telefone_normalized,
    la.cidade,
    la.uf,
    j.data_primeira_compra,
    j.data_ultima_compra,
    j.qtd_unidades,
    j.receita_total,
    j.n_deals,
    j.n_nfs,
    j.fonte,
    la.data_ultima_compra_insumos::date,
    CASE WHEN la.data_ultima_compra_insumos IS NOT NULL
      THEN (CURRENT_DATE - la.data_ultima_compra_insumos::date) ELSE NULL END,
    CASE
      WHEN la.data_ultima_compra_insumos IS NULL THEN 'sem_recompra'
      WHEN (CURRENT_DATE - la.data_ultima_compra_insumos::date) <= 45 THEN 'ativo'
      WHEN (CURRENT_DATE - la.data_ultima_compra_insumos::date) <= 90 THEN 'alerta'
      ELSE 'inativo'
    END
  FROM joined j
  LEFT JOIN lia_attendances la ON la.id = j.lead_id AND la.merged_into IS NULL
  ORDER BY j.data_primeira_compra DESC NULLS LAST;
$$;