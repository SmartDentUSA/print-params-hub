
CREATE OR REPLACE FUNCTION public._dbg_inside_fn(p_lead_id uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c1 int; c2 int; c3 int;
BEGIN
  SELECT COUNT(*) INTO c1 FROM deal_items di JOIN deals d ON d.piperun_deal_id::text=di.deal_id WHERE di.lead_id=p_lead_id AND d.status='ganha';
  WITH won AS (
    SELECT lower(trim(coalesce(di.product_name, di.nome_produto,''))) AS pname
    FROM deal_items di JOIN deals d ON d.piperun_deal_id::text=di.deal_id
    WHERE di.lead_id=p_lead_id AND d.status='ganha' AND coalesce(di.product_name,di.nome_produto,'')<>''
  )
  SELECT COUNT(*) INTO c2 FROM won;
  WITH won AS (
    SELECT lower(trim(coalesce(di.product_name, di.nome_produto,''))) AS pname
    FROM deal_items di JOIN deals d ON d.piperun_deal_id::text=di.deal_id
    WHERE di.lead_id=p_lead_id AND d.status='ganha' AND coalesce(di.product_name,di.nome_produto,'')<>''
  )
  SELECT COUNT(*) INTO c3 FROM won w JOIN workflow_cell_mappings m ON m.mapping_type='product' AND (
    w.pname=lower(m.mapped_label) OR w.pname LIKE '%' || lower(m.mapped_label) || '%'
  );
  RETURN format('items=%s won=%s matched=%s', c1, c2, c3);
END $$;
