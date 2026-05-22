DROP FUNCTION IF EXISTS public.fn_product_owners(text);

CREATE OR REPLACE FUNCTION public.fn_product_owners(_busca text)
RETURNS TABLE (
  lead_id uuid,
  nome text,
  email text,
  telefone text,
  cidade text,
  uf text,
  data_primeira_compra timestamptz,
  data_ultima_compra timestamptz,
  qtd_unidades numeric,
  receita_total numeric,
  n_deals integer,
  fonte text,
  data_ultima_compra_insumos timestamptz,
  dias_desde_insumo integer,
  status_recompra text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT
      la.id AS lead_id,
      la.nome,
      la.email,
      la.telefone_normalized AS telefone,
      la.cidade,
      la.uf,
      MIN(d.closed_at) AS data_primeira_compra,
      MAX(d.closed_at) AS data_ultima_compra,
      SUM(COALESCE(di.quantity, di.quantidade, 1))::numeric AS qtd_unidades,
      SUM(COALESCE(di.total_value, di.valor_total, d.value, 0))::numeric AS receita_total,
      COUNT(DISTINCT d.id)::int AS n_deals,
      la.data_ultima_compra_insumos
    FROM public.deals d
    JOIN public.deal_items di ON di.deal_id = d.piperun_deal_id
    JOIN public.lia_attendances la
      ON la.id = d.lead_id AND la.merged_into IS NULL
    WHERE d.status = 'ganha'
      AND (di.product_name ILIKE '%' || _busca || '%'
        OR di.nome_produto ILIKE '%' || _busca || '%')
    GROUP BY la.id, la.nome, la.email, la.telefone_normalized, la.cidade, la.uf, la.data_ultima_compra_insumos
  )
  SELECT
    b.lead_id, b.nome, b.email, b.telefone, b.cidade, b.uf,
    b.data_primeira_compra, b.data_ultima_compra,
    b.qtd_unidades, b.receita_total, b.n_deals,
    'piperun'::text,
    b.data_ultima_compra_insumos,
    CASE WHEN b.data_ultima_compra_insumos IS NULL THEN NULL
      ELSE EXTRACT(DAY FROM (now() - b.data_ultima_compra_insumos))::int END,
    CASE
      WHEN b.data_ultima_compra_insumos IS NULL THEN 'sem_recompra'
      WHEN now() - b.data_ultima_compra_insumos <= interval '45 days' THEN 'ativo'
      WHEN now() - b.data_ultima_compra_insumos <= interval '90 days' THEN 'alerta'
      ELSE 'inativo'
    END
  FROM base b
  ORDER BY b.receita_total DESC NULLS LAST;
$$;