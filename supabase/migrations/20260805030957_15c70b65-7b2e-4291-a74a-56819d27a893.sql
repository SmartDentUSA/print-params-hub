CREATE OR REPLACE FUNCTION public.fn_expand_deal_proposals_to_items(p_deal_id text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
  d record;
BEGIN
  SELECT piperun_deal_id::text AS deal_key, lead_id, proposals, owner_name,
         closed_at, piperun_created_at, freight_type, payment_method, payment_installments
    INTO d
  FROM public.deals
  WHERE piperun_deal_id::text = p_deal_id
  LIMIT 1;

  IF d IS NULL OR d.proposals IS NULL OR jsonb_typeof(d.proposals) <> 'array' THEN
    RETURN 0;
  END IF;

  DELETE FROM public.deal_items
  WHERE deal_id = d.deal_key AND source = 'piperun_proposal_json';

  INSERT INTO public.deal_items (
    lead_id, deal_id, proposal_id, product_name, nome_produto,
    product_code, cod_produto, sku,
    quantity, quantidade, unit_value, valor_unitario, total_value, valor_total,
    freight_type, tipo_frete, freight_value, valor_frete,
    payment_method, metodo_pagamento, installments, num_parcelas,
    deal_date, data_proposta, vendor_name, source, proposta_raw, synced_at
  )
  SELECT
    d.lead_id,
    d.deal_key,
    (p->>'id'),
    it->>'nome',
    it->>'nome',
    nullif(it->>'sku',''),
    nullif(it->>'sku',''),
    nullif(it->>'sku',''),
    coalesce((it->>'qtd')::numeric, (it->>'quantity')::numeric, 1),
    coalesce((it->>'qtd')::numeric, (it->>'quantity')::numeric, 1),
    nullif(it->>'unit','')::numeric,
    nullif(it->>'unit','')::numeric,
    coalesce(nullif(it->>'total','')::numeric,
             coalesce((it->>'qtd')::numeric,1) * coalesce(nullif(it->>'unit','')::numeric,0)),
    coalesce(nullif(it->>'total','')::numeric,
             coalesce((it->>'qtd')::numeric,1) * coalesce(nullif(it->>'unit','')::numeric,0)),
    coalesce(nullif(p->>'tipo_frete',''), d.freight_type),
    coalesce(nullif(p->>'tipo_frete',''), d.freight_type),
    nullif(p->>'valor_frete','')::numeric,
    nullif(p->>'valor_frete','')::numeric,
    d.payment_method,
    d.payment_method,
    coalesce(nullif(p->>'parcelas','')::int, d.payment_installments),
    coalesce(nullif(p->>'parcelas','')::int, d.payment_installments),
    coalesce(d.closed_at, d.piperun_created_at)::date,
    coalesce(d.closed_at, d.piperun_created_at),
    coalesce(nullif(p->>'vendedor',''), d.owner_name),
    'piperun_proposal_json',
    p,
    now()
  FROM jsonb_array_elements(d.proposals) p
  CROSS JOIN LATERAL jsonb_array_elements(coalesce(p->'items','[]'::jsonb)) it
  WHERE coalesce(nullif(it->>'nome',''), '') <> ''
    AND NOT EXISTS (
      SELECT 1 FROM public.deal_items x
      WHERE x.deal_id = d.deal_key
        AND x.source <> 'piperun_proposal_json'
        AND coalesce(x.proposal_id,'') = coalesce(p->>'id','')
        AND coalesce(x.sku, x.cod_produto, x.product_code, '') = coalesce(nullif(it->>'sku',''), '')
    );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END
$$;

CREATE OR REPLACE FUNCTION public.trg_deals_expand_proposal_items()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.piperun_deal_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.proposals IS NULL OR jsonb_typeof(NEW.proposals) <> 'array' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND coalesce(OLD.proposals::text,'') = coalesce(NEW.proposals::text,'')
     AND coalesce(OLD.closed_at, '-infinity'::timestamptz) = coalesce(NEW.closed_at, '-infinity'::timestamptz) THEN
    RETURN NEW;
  END IF;
  PERFORM public.fn_expand_deal_proposals_to_items(NEW.piperun_deal_id::text);
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS deals_expand_proposal_items ON public.deals;
CREATE TRIGGER deals_expand_proposal_items
AFTER INSERT OR UPDATE OF proposals, closed_at, status ON public.deals
FOR EACH ROW EXECUTE FUNCTION public.trg_deals_expand_proposal_items();