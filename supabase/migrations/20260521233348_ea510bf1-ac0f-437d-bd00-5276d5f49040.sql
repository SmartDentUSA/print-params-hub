-- 1) Adiciona coluna nf_direcao (entrada/saida) baseada no CFOP predominante dos itens
ALTER TABLE public.omie_notas_fiscais
  ADD COLUMN IF NOT EXISTS nf_direcao text;

CREATE INDEX IF NOT EXISTS idx_omie_nf_direcao ON public.omie_notas_fiscais(nf_direcao);

-- 2) Função utilitária para classificar pelo CFOP (1/2/3 = entrada, 5/6/7 = saida)
CREATE OR REPLACE FUNCTION public.fn_classify_nf_direcao(p_nf_id uuid)
RETURNS text
LANGUAGE sql STABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN LEFT(MODE() WITHIN GROUP (ORDER BY cfop), 1) IN ('1','2','3') THEN 'entrada'
    WHEN LEFT(MODE() WITHIN GROUP (ORDER BY cfop), 1) IN ('5','6','7') THEN 'saida'
    ELSE 'desconhecido'
  END
  FROM public.omie_nf_items
  WHERE nf_id = p_nf_id AND cfop IS NOT NULL;
$$;

-- 3) Backfill em massa (1 query)
WITH classificacao AS (
  SELECT
    nf_id,
    CASE
      WHEN LEFT(MODE() WITHIN GROUP (ORDER BY cfop), 1) IN ('1','2','3') THEN 'entrada'
      WHEN LEFT(MODE() WITHIN GROUP (ORDER BY cfop), 1) IN ('5','6','7') THEN 'saida'
      ELSE 'desconhecido'
    END AS direcao
  FROM public.omie_nf_items
  WHERE cfop IS NOT NULL
  GROUP BY nf_id
)
UPDATE public.omie_notas_fiscais n
SET nf_direcao = c.direcao,
    updated_at = now()
FROM classificacao c
WHERE n.id = c.nf_id
  AND (n.nf_direcao IS DISTINCT FROM c.direcao);

-- 4) Trigger para manter nf_direcao atualizado quando itens forem inseridos/alterados
CREATE OR REPLACE FUNCTION public.tg_sync_nf_direcao()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_nf_id uuid;
  v_dir text;
BEGIN
  v_nf_id := COALESCE(NEW.nf_id, OLD.nf_id);
  SELECT public.fn_classify_nf_direcao(v_nf_id) INTO v_dir;
  UPDATE public.omie_notas_fiscais
    SET nf_direcao = v_dir, updated_at = now()
  WHERE id = v_nf_id AND (nf_direcao IS DISTINCT FROM v_dir);
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_nf_direcao ON public.omie_nf_items;
CREATE TRIGGER trg_sync_nf_direcao
AFTER INSERT OR UPDATE OF cfop ON public.omie_nf_items
FOR EACH ROW EXECUTE FUNCTION public.tg_sync_nf_direcao();

-- 5) Atualiza views para considerar APENAS notas de SAÍDA (vendas reais)
CREATE OR REPLACE VIEW public.vw_produtos_faturados AS
SELECT i.produto_codigo,
    i.produto_nome,
    i.ncm,
    CASE
        WHEN upper(i.produto_nome) ~~ '%SCANNER%' OR upper(i.produto_nome) ~~ '%INO %' OR upper(i.produto_nome) ~~ '%INTRAORAL%' OR upper(i.produto_nome) ~~ 'INO2%' THEN 'scanner'
        WHEN upper(i.produto_nome) ~~ '%IMPRESSORA%' OR upper(i.produto_nome) ~~ '%EDGE MINI%' OR upper(i.produto_nome) ~~ '%MIICRAFT%' OR upper(i.produto_nome) ~~ '%RAYSHAPE%' OR upper(i.produto_nome) ~~ '%HALOT%' THEN 'impressora_3d'
        WHEN upper(i.produto_nome) ~~ '%RESINA%' OR upper(i.produto_nome) ~~ '%SMART PRINT%' OR upper(i.produto_nome) ~~ '%BITE%' OR upper(i.produto_nome) ~~ '%VITALITY%' OR upper(i.produto_nome) ~~ '%TRY-IN%' THEN 'insumo_resina'
        WHEN upper(i.produto_nome) ~~ '%NOTE%' OR upper(i.produto_nome) ~~ '%NOTEBOOK%' OR upper(i.produto_nome) ~~ '%AVELL%' THEN 'notebook'
        WHEN upper(i.produto_nome) ~~ '%SOFTWARE%' OR upper(i.produto_nome) ~~ '%EXOCAD%' OR upper(i.produto_nome) ~~ '%LICEN%' THEN 'software'
        WHEN upper(i.produto_nome) ~~ '%KIT%' THEN 'kit'
        WHEN upper(i.produto_nome) ~~ '%POS CURA%' OR upper(i.produto_nome) ~~ '%WASH%' OR upper(i.produto_nome) ~~ '%CURE%' THEN 'pos_impressao'
        ELSE 'outros'
    END AS categoria,
    n.vendedor_nome,
    n.vendedor_codigo,
    n.canal,
    n.data_competencia,
    date_trunc('month', n.data_competencia::timestamp with time zone)::date AS mes,
    n.tipo_operacao,
    i.quantidade,
    i.valor_unitario,
    i.valor_total,
    n.id AS nf_id,
    n.numero_nf,
    n.cliente_nome
FROM public.omie_nf_items i
JOIN public.omie_notas_fiscais n ON n.id = i.nf_id
WHERE n.status = 'emitida'
  AND n.tipo_operacao <> 'exportacao'
  AND COALESCE(n.nf_direcao,'saida') = 'saida'
  AND LEFT(COALESCE(i.cfop,'5'),1) IN ('5','6','7');

CREATE OR REPLACE VIEW public.vw_omie_vendas_mes AS
SELECT date_trunc('month', n.data_competencia::timestamp with time zone)::date AS mes,
    v.codigo AS vendedor_codigo,
    COALESCE(v.nome_omie, n.vendedor_nome) AS vendedor_omie,
    COALESCE(v.nome_piperun, n.vendedor_nome) AS vendedor_piperun,
    v.canal,
    count(DISTINCT n.id) AS total_nfs,
    COALESCE(sum(i.quantidade), 0) AS total_itens,
    sum(n.valor_produtos) AS valor_produtos,
    sum(n.valor_frete) AS valor_frete,
    sum(n.valor_desconto) AS valor_desconto,
    sum(n.valor_total) AS valor_faturado
FROM public.omie_notas_fiscais n
LEFT JOIN public.omie_vendedores v ON v.codigo = n.vendedor_codigo
LEFT JOIN public.omie_nf_items i ON i.nf_id = n.id
WHERE n.status = 'emitida'
  AND COALESCE(n.nf_direcao,'saida') = 'saida'
GROUP BY 1, v.codigo, COALESCE(v.nome_omie, n.vendedor_nome), COALESCE(v.nome_piperun, n.vendedor_nome), v.canal;

-- 6) View de NFs sem deal: só faz sentido reconciliar saídas
CREATE OR REPLACE VIEW public.v_omie_nfs_sem_deal AS
SELECT id, numero_nf, vendedor_nome, canal, cliente_nome, cliente_cpf_cnpj,
       valor_total, data_emissao, lead_id, piperun_deal_id, reconciliado
FROM public.omie_notas_fiscais
WHERE status <> 'cancelada'
  AND piperun_deal_id IS NULL
  AND COALESCE(nf_direcao,'saida') = 'saida'
  AND canal NOT IN ('representante','site','marketplace')
ORDER BY valor_total DESC;