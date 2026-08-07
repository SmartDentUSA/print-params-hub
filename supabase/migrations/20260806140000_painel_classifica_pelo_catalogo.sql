-- O painel classificava produto olhando SÓ a product_taxonomy (padrões manuais) e
-- ignorava o catálogo, onde o produto já está categorizado. Resultado: itens que
-- ESTÃO mapeados no catálogo caíam em "nao_classificado" e sumiam do grid —
-- "Ativação DentalCAD Ultimate Lab Bundle - RMS" é product / 2. CAD / 2.1 SOFTWARE
-- no system_a_catalog e mesmo assim não aparecia.
--
-- Agora a ordem é: (1) entrada específica da product_taxonomy, (2) CATÁLOGO,
-- (3) entrada guarda-chuva da product_taxonomy.
--
-- O catálogo é lido respeitando a allowlist de tipos comerciais (category em
-- product/resin/Resinas/consumables/Serviços) — category_config, video_testimonial
-- e company_info não são produto e continuam de fora.
CREATE OR REPLACE FUNCTION public.painel_catalogo_etapa(p_categoria text, p_subcategoria text)
 RETURNS TABLE(workflow_stage text, subcategory text)
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT
    CASE
      WHEN p_categoria ILIKE '1.%'                      THEN 'etapa_1_scanner'
      WHEN p_categoria ILIKE '2.%'                      THEN 'etapa_2_cad'
      WHEN p_categoria ILIKE '3.%'                      THEN 'etapa_3_impressao'
      WHEN p_categoria ILIKE '4.%'                      THEN 'etapa_4_pos_impressao'
      WHEN p_categoria ILIKE '5.%'                      THEN 'etapa_5_finalizacao'
      WHEN p_categoria ILIKE '6.%' AND p_categoria ILIKE '%curso%'  THEN 'etapa_6_cursos'
      WHEN p_categoria ILIKE '6.%'                      THEN 'etapa_5_finalizacao'
      WHEN p_categoria ILIKE '7.%'                      THEN 'etapa_7_fresagem'
    END,
    CASE
      WHEN p_subcategoria ILIKE '%scanner intraoral%'   THEN 'scanner_intraoral'
      WHEN p_subcategoria ILIKE '%scanner bancada%'     THEN 'scanner_bancada'
      WHEN p_subcategoria ILIKE '%notebook%'            THEN 'notebook'
      WHEN p_categoria    ILIKE '1.%' AND p_subcategoria ILIKE '%acess%' THEN 'acessorios'
      WHEN p_categoria    ILIKE '2.%' AND p_subcategoria ILIKE '%software%' THEN 'software'
      WHEN p_categoria    ILIKE '2.%' AND p_subcategoria ILIKE '%servi%'    THEN 'servico'
      WHEN p_categoria    ILIKE '2.%' AND p_subcategoria ILIKE '%cr%dito%'  THEN 'credito_ia'
      WHEN p_subcategoria ILIKE '%resina%3d%' OR p_subcategoria ILIKE '%resinas 3d%' THEN 'resinas'
      WHEN p_categoria    ILIKE '3.%' AND p_subcategoria ILIKE '%software%' THEN 'software_impressao'
      WHEN p_subcategoria ILIKE '%impressora%'          THEN 'impressora'
      WHEN p_categoria    ILIKE '3.%' AND p_subcategoria ILIKE '%acess%'    THEN 'acessorios'
      WHEN p_categoria    ILIKE '4.%' AND p_subcategoria ILIKE '%equipamento%' THEN 'equipamentos'
      WHEN p_subcategoria ILIKE '%limpeza%' OR p_subcategoria ILIKE '%acabamento%' THEN 'limpeza_acabamento'
      WHEN p_subcategoria ILIKE '%caracteriza%'         THEN 'caracterizacao'
      WHEN p_subcategoria ILIKE '%cimento%'             THEN 'instalacao'
      WHEN p_subcategoria ILIKE '%resinas compostas%'   THEN 'dentistica_orto'
      WHEN p_subcategoria ILIKE '%presencial%'          THEN 'presencial'
      WHEN p_subcategoria ILIKE '%online%'              THEN 'online'
      WHEN p_categoria    ILIKE '7.%' AND p_subcategoria ILIKE '%insumo%'      THEN 'insumos'
      WHEN p_categoria    ILIKE '7.%' AND p_subcategoria ILIKE '%equipamento%' THEN 'equipamentos'
      WHEN p_categoria    ILIKE '7.%' AND p_subcategoria ILIKE '%software%'    THEN 'software'
      WHEN p_categoria    ILIKE '7.%' AND p_subcategoria ILIKE '%servi%'       THEN 'servico'
    END
$function$;

CREATE OR REPLACE FUNCTION public.painel_match_taxonomy(p_nome text)
 RETURNS TABLE(workflow_stage text, subcategory text, display_name text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH taxonomia AS (
    SELECT t.workflow_stage, t.subcategory, t.display_name,
           CASE WHEN t.is_generic THEN 3 ELSE 1 END AS prioridade,
           m.especificidade,
           length(coalesce(t.display_name,'')) AS tam
    FROM public.product_taxonomy t
    CROSS JOIN LATERAL (
      SELECT max(length(pat)) AS especificidade
      FROM unnest(t.match_patterns) pat
      WHERE p_nome ILIKE '%' || pat || '%'
    ) m
    WHERE p_nome IS NOT NULL AND m.especificidade IS NOT NULL
  ), catalogo AS (
    /* nome do produto no catálogo, direto ou via variante cadastrada em produto_aliases */
    SELECT e.workflow_stage, e.subcategory, c.name AS display_name,
           2 AS prioridade, length(c.name) AS especificidade, length(c.name) AS tam
    FROM public.system_a_catalog c
    CROSS JOIN LATERAL public.painel_catalogo_etapa(c.product_category, c.product_subcategory) e
    WHERE p_nome IS NOT NULL
      AND c.category IN ('product','resin','Resinas','consumables','Serviços')
      AND e.workflow_stage IS NOT NULL AND e.subcategory IS NOT NULL
      AND (
        public.painel_nome_norm(c.name) = public.painel_nome_norm(p_nome)
        OR EXISTS (
          SELECT 1 FROM public.produto_aliases a
          WHERE coalesce(a.ativo,true)
            AND public.painel_nome_norm(a.nome_variante) = public.painel_nome_norm(p_nome)
            AND public.painel_nome_norm(a.nome_canonico) = public.painel_nome_norm(c.name)
        )
      )
  )
  SELECT z.workflow_stage, z.subcategory, z.display_name
  FROM (SELECT * FROM taxonomia UNION ALL SELECT * FROM catalogo) z
  ORDER BY z.prioridade, z.especificidade DESC, z.tam DESC
  LIMIT 1
$function$;
