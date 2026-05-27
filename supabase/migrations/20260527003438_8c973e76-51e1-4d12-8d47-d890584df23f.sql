
CREATE OR REPLACE FUNCTION public._debug_pf(p_lead_id uuid) RETURNS int
LANGUAGE sql SECURITY DEFINER SET search_path=public, pg_temp AS $$
  SELECT COUNT(*)::int
  FROM deal_items di
  JOIN deals d ON d.piperun_deal_id::text = di.deal_id
  WHERE di.lead_id = p_lead_id AND d.status='ganha';
$$;
