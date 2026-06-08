CREATE OR REPLACE FUNCTION public.vendas_restore_candidates_at(cutoff timestamptz)
RETURNS TABLE (
  deal_id text,
  stage_0606 text,
  from_pipeline integer,
  from_stage text,
  from_stage_id integer,
  local_status text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH snap AS (
    SELECT DISTINCT ON (deal_id)
      deal_id::text AS deal_id,
      stage_to_name,
      COALESCE(deal_status, 0) AS deal_status
    FROM public.piperun_stage_transitions
    WHERE pipeline_id = 18784
      AND created_at <= cutoff
    ORDER BY deal_id, created_at DESC
  ),
  snap_open AS (
    SELECT * FROM snap
    WHERE deal_status = 0
      AND stage_to_name IN (
        'C1','C2','C3','SDR / Nutrição','Contato Feito','Em Contato',
        'Apresentação/Visita','Proposta enviada','Proposta enviada (TEMP)','Negociação'
      )
  ),
  stage_order AS (
    SELECT * FROM (VALUES
      ('Sem contato', 0),('sem_contato', 0),('Novos Leads', 0),
      ('C1', 1),('Contato Feito', 1),
      ('C2', 2),('C3', 3),
      ('SDR / Nutrição', 4),('Em Contato', 4),
      ('Apresentação/Visita', 5),
      ('Proposta enviada', 6),('Proposta enviada (TEMP)', 6),
      ('Negociação', 7),('LTV', 8),('Fechamento', 9)
    ) AS t(name, ord)
  )
  SELECT
    s.deal_id,
    s.stage_to_name AS stage_0606,
    d.pipeline_id AS from_pipeline,
    d.stage_name AS from_stage,
    d.stage_id AS from_stage_id,
    d.status AS local_status
  FROM snap_open s
  JOIN public.deals d ON d.piperun_deal_id::text = s.deal_id
  LEFT JOIN stage_order so_snap ON so_snap.name = s.stage_to_name
  LEFT JOIN stage_order so_cur  ON so_cur.name  = d.stage_name
  WHERE LOWER(COALESCE(d.status,'')) NOT IN ('won','lost','ganha','perdida')
    AND d.pipeline_id IN (18784, 72938)
    -- Pula CS Onboarding por segurança (mesmo que filtro acima já cobre)
    AND d.pipeline_id <> 83896
    AND (
      -- Em Estagnados: sempre candidato
      d.pipeline_id = 72938
      OR (
        -- No 18784: só se regrediu (ordem menor) e NÃO está na primeira etapa
        d.pipeline_id = 18784
        AND COALESCE(so_cur.ord, -1) > 0
        AND COALESCE(so_cur.ord, 99) < COALESCE(so_snap.ord, 0)
        AND d.stage_name <> s.stage_to_name
      )
    );
$$;

GRANT EXECUTE ON FUNCTION public.vendas_restore_candidates_at(timestamptz) TO authenticated, service_role;