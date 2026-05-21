-- 1) Reclassifica importação ESSTECH (sem itens, fornecedor estrangeiro)
UPDATE public.omie_notas_fiscais
SET nf_direcao = 'entrada', updated_at = now()
WHERE numero_nf = '00040928'
  AND cliente_nome ILIKE 'ESSTECH%'
  AND nf_direcao IS NULL;

-- 2) Corrige inflação na view: agrega NF e itens separadamente
CREATE OR REPLACE VIEW public.vw_omie_vendas_mes AS
WITH nfs AS (
  SELECT
    date_trunc('month', n.data_competencia::timestamp with time zone)::date AS mes,
    v.codigo AS vendedor_codigo,
    COALESCE(v.nome_omie, n.vendedor_nome) AS vendedor_omie,
    COALESCE(v.nome_piperun, n.vendedor_nome) AS vendedor_piperun,
    v.canal,
    n.id AS nf_id,
    n.valor_total,
    n.valor_produtos,
    n.valor_frete,
    n.valor_desconto
  FROM public.omie_notas_fiscais n
  LEFT JOIN public.omie_vendedores v ON v.codigo = n.vendedor_codigo
  WHERE n.status = 'emitida'
    AND COALESCE(n.nf_direcao,'saida') = 'saida'
),
itens AS (
  SELECT i.nf_id, SUM(i.quantidade) AS qtd
  FROM public.omie_nf_items i
  GROUP BY i.nf_id
)
SELECT
  n.mes,
  n.vendedor_codigo,
  n.vendedor_omie,
  n.vendedor_piperun,
  n.canal,
  COUNT(DISTINCT n.nf_id) AS total_nfs,
  COALESCE(SUM(it.qtd), 0) AS total_itens,
  SUM(n.valor_produtos) AS valor_produtos,
  SUM(n.valor_frete) AS valor_frete,
  SUM(n.valor_desconto) AS valor_desconto,
  SUM(n.valor_total) AS valor_faturado
FROM nfs n
LEFT JOIN itens it ON it.nf_id = n.nf_id
GROUP BY n.mes, n.vendedor_codigo, n.vendedor_omie, n.vendedor_piperun, n.canal;