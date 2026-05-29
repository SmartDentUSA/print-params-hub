-- Speed up fn_relatorio_mes_funil_atual (filters status='aberta')
CREATE INDEX IF NOT EXISTS idx_deals_aberta_owner
  ON public.deals (owner_name, pipeline_name, stage_name)
  WHERE status = 'aberta' AND COALESCE(is_deleted, false) = false;

-- Speed up fn_relatorio_mes_vendedor / kpis (filters by closed_at month + status)
CREATE INDEX IF NOT EXISTS idx_deals_closed_status_owner
  ON public.deals (closed_at, status, owner_name)
  WHERE closed_at IS NOT NULL AND COALESCE(is_deleted, false) = false;

-- Speed up leads_mes lookup (created_at month)
CREATE INDEX IF NOT EXISTS idx_deals_created_owner
  ON public.deals (COALESCE(piperun_created_at, created_at), owner_name)
  WHERE COALESCE(is_deleted, false) = false;