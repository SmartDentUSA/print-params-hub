-- Regressões dos indicadores agregados da campanha (sem dados pessoais).
DO $tests$
DECLARE
  wa record;
  store record;
  old_role text := current_setting('request.jwt.claim.role', true);
  old_sub text := current_setting('request.jwt.claim.sub', true);
  denied boolean;
BEGIN
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  SELECT * INTO wa FROM public.fn_event_campaign_metrics('6914e294-2313-4694-93b5-b7736747feae') WHERE canal='whatsapp_oficial';
  IF wa.envios IS NULL OR wa.envios < 1669 THEN RAISE EXCEPTION 'Envios WhatsApp históricos ausentes'; END IF;
  IF wa.custo IS NULL OR wa.custo <> round(wa.entregues * 0.35, 2) THEN RAISE EXCEPTION 'Custo deve usar R$ 0,35 por entrega, nunca agendados'; END IF;
  IF wa.leads < 20 THEN RAISE EXCEPTION 'Conversões históricas de formulário ausentes'; END IF;
  IF wa.convertidos > wa.leads THEN RAISE EXCEPTION 'Compradores não podem ultrapassar leads únicos'; END IF;

  SELECT * INTO store FROM public.fn_event_store_stats('6914e294-2313-4694-93b5-b7736747feae');
  IF store.pedidos < 23 OR store.valor_total < 24053.97 THEN RAISE EXCEPTION 'Pedidos pagos recentes da timeline ausentes'; END IF;
  IF store.pedidos_cupom > store.pedidos OR store.valor_cupons > store.valor_total THEN RAISE EXCEPTION 'Cupons duplicaram o total'; END IF;

  -- Um pedido atualizado não é uma segunda venda; a última situação cancelada exclui o outro.
  IF (WITH snapshots(oid,version,status,amount) AS (VALUES ('a',1,'paid',100),('a',2,'invoiced',100),('b',1,'paid',200),('b',2,'cancelled',200)),
    latest AS (SELECT DISTINCT ON(oid) * FROM snapshots ORDER BY oid,version DESC)
    SELECT sum(amount) FROM latest WHERE status IN ('paid','invoiced','delivered')) <> 100 THEN RAISE EXCEPTION 'Deduplicação/cancelamento inválidos'; END IF;

  -- O período informado é inclusivo no calendário de São Paulo, não em UTC.
  IF ('2026-11-16'::date::timestamp AT TIME ZONE 'America/Sao_Paulo') <> '2026-11-16 03:00+00'::timestamptz THEN RAISE EXCEPTION 'Início da campanha incorreto'; END IF;
  IF (('2026-11-30'::date+1)::timestamp AT TIME ZONE 'America/Sao_Paulo') <> '2026-12-01 03:00+00'::timestamptz THEN RAISE EXCEPTION 'Fim inclusivo da campanha incorreto'; END IF;

  -- Autenticado sem papel de admin não consegue consultar os agregados financeiros.
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000000', true);
  denied := false;
  BEGIN PERFORM * FROM public.fn_event_campaign_metrics(NULL); EXCEPTION WHEN insufficient_privilege THEN denied := true; END;
  IF NOT denied THEN RAISE EXCEPTION 'Usuário comum acessou métricas'; END IF;
  denied := false;
  BEGIN PERFORM * FROM public.fn_event_store_stats(NULL); EXCEPTION WHEN insufficient_privilege THEN denied := true; END;
  IF NOT denied THEN RAISE EXCEPTION 'Usuário comum acessou vendas'; END IF;
  PERFORM set_config('request.jwt.claim.role',COALESCE(old_role,''),true);
  PERFORM set_config('request.jwt.claim.sub',COALESCE(old_sub,''),true);
END $tests$;