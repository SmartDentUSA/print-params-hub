-- Teste da regra de ordem dos fluxos em claim_pending_wa_messages.
-- Tudo roda numa única transação que termina em RAISE EXCEPTION → nada é gravado.
-- O resultado vem na mensagem do erro: começa com "TESTE OK" ou "TESTE FALHOU".
DO $t$
DECLARE
  ca uuid := gen_random_uuid();  -- fluxo, 2 grupos x 10 itens, mesmo scheduled_at
  cb uuid := gen_random_uuid();  -- fluxo, seq 1 no futuro bloqueia seq 2 e 3
  cc uuid := gen_random_uuid();  -- blast, 3 grupos em paralelo
  t0 timestamptz := now() - interval '1 minute';
  r record; g text; i int; rounds int := 0; batch int;
  orders jsonb := '{}'::jsonb; errs text := '';
  seen_a1 int := 0; seen_a2 int := 0; last_a1 int := 0; last_a2 int := 0;
  parallel_ok bool := false; blast_ok bool := false; b_blocked bool := true;
  concurrent_dupes int := 0;
BEGIN
  INSERT INTO wa_campaigns (id, name, status, campaign_type, flow_json) VALUES
    (ca, '__teste_ordem_A', 'active', 'flow', '[]'),
    (cb, '__teste_ordem_B', 'active', 'flow', '[]'),
    (cc, '__teste_ordem_C', 'active', 'blast', '[]');
  FOREACH g IN ARRAY ARRAY['__a1@g.us','__a2@g.us'] LOOP
    FOR i IN 1..10 LOOP
      INSERT INTO wa_message_queue (campaign_id, group_jid, node_id, node_index, sequence_no, node_type, scheduled_at, status)
      VALUES (ca, g, 'n' || i, 11 - i, i, 'msg', t0, 'pending');  -- node_index invertido de propósito
    END LOOP;
  END LOOP;
  INSERT INTO wa_message_queue (campaign_id, group_jid, node_id, node_index, sequence_no, node_type, scheduled_at, status) VALUES
    (cb, '__b1@g.us', 'n1', 0, 1, 'msg', now() + interval '1 day', 'pending'),
    (cb, '__b1@g.us', 'n2', 1, 2, 'msg', t0, 'pending'),
    (cb, '__b1@g.us', 'n3', 2, 3, 'msg', t0, 'pending');
  FOR i IN 1..3 LOOP
    INSERT INTO wa_message_queue (campaign_id, group_jid, node_id, node_index, sequence_no, node_type, scheduled_at, status)
    VALUES (cc, '__c' || i || '@g.us', 'n1', 0, 1, 'msg', t0, 'pending');
  END LOOP;

  CREATE TEMP TABLE _claimed (id uuid, campaign_id uuid, group_jid text, sequence_no int) ON COMMIT DROP;
  LOOP
    rounds := rounds + 1; EXIT WHEN rounds > 40;
    TRUNCATE _claimed;
    INSERT INTO _claimed SELECT x.id, x.campaign_id, x.group_jid, x.sequence_no FROM claim_pending_wa_messages(50) x
      WHERE x.campaign_id IN (ca, cb, cc);
    SELECT count(*) INTO batch FROM _claimed;
    EXIT WHEN batch = 0;
    -- "execução simultânea": outra reserva antes de terminar a primeira
    SELECT count(*) INTO i FROM claim_pending_wa_messages(50) x WHERE x.campaign_id IN (ca, cb);
    concurrent_dupes := concurrent_dupes + i;
    IF (SELECT count(*) FROM _claimed WHERE campaign_id = ca AND group_jid = '__a1@g.us') > 1
       OR (SELECT count(*) FROM _claimed WHERE campaign_id = ca AND group_jid = '__a2@g.us') > 1 THEN
      errs := errs || ' mais de 1 item por grupo na mesma reserva;';
    END IF;
    IF EXISTS (SELECT 1 FROM _claimed WHERE campaign_id = ca AND group_jid = '__a1@g.us')
       AND EXISTS (SELECT 1 FROM _claimed WHERE campaign_id = ca AND group_jid = '__a2@g.us') THEN parallel_ok := true; END IF;
    IF (SELECT count(*) FROM _claimed WHERE campaign_id = cc) = 3 THEN blast_ok := true; END IF;
    IF EXISTS (SELECT 1 FROM _claimed WHERE campaign_id = cb) THEN b_blocked := false; END IF;
    FOR r IN SELECT * FROM _claimed WHERE campaign_id = ca ORDER BY sequence_no LOOP
      IF r.group_jid = '__a1@g.us' THEN
        IF r.sequence_no <> last_a1 + 1 THEN errs := errs || format(' a1 fora de ordem (%s depois de %s);', r.sequence_no, last_a1); END IF;
        last_a1 := r.sequence_no; seen_a1 := seen_a1 + 1;
      ELSE
        IF r.sequence_no <> last_a2 + 1 THEN errs := errs || format(' a2 fora de ordem (%s depois de %s);', r.sequence_no, last_a2); END IF;
        last_a2 := r.sequence_no; seen_a2 := seen_a2 + 1;
      END IF;
    END LOOP;
    -- simula o envio concluído (alternando sent/failed/skipped: todos liberam o próximo)
    UPDATE wa_message_queue q SET status = (ARRAY['sent','failed','skipped'])[1 + (c.sequence_no % 3)]
      FROM _claimed c WHERE q.id = c.id;
  END LOOP;

  IF seen_a1 <> 10 OR seen_a2 <> 10 THEN errs := errs || format(' a1=%s a2=%s itens enviados (esperado 10);', seen_a1, seen_a2); END IF;
  IF concurrent_dupes > 0 THEN errs := errs || format(' reserva simultânea pegou %s itens do mesmo grupo;', concurrent_dupes); END IF;
  IF NOT parallel_ok THEN errs := errs || ' grupos diferentes não andaram em paralelo;'; END IF;
  IF NOT blast_ok THEN errs := errs || ' blast não saiu em paralelo;'; END IF;
  IF NOT b_blocked THEN errs := errs || ' item com sequência menor no futuro não bloqueou;'; END IF;

  IF errs = '' THEN
    RAISE EXCEPTION 'TESTE OK: a1 e a2 1..10 em ordem, % rodadas, grupos em paralelo, blast em paralelo, futuro bloqueia, 0 duplicidade simultânea', rounds - 1;
  ELSE
    RAISE EXCEPTION 'TESTE FALHOU:%', errs;
  END IF;
END
$t$;
