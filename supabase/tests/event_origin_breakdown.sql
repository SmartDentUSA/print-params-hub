-- Regressão: as três origens da Black Friday entram no mesmo total, separadas por origem.
DO $t$
DECLARE
  stats record;
  expected text;
  origins text[] := ARRAY[
    '# - [BLACK26] - Campanha ativa',
    '[WHTASATIVO] - BlackFriday 2026',
    '# - [BLACK26] - Engajamento'
  ];
BEGIN
  SELECT * INTO stats
  FROM public.fn_event_lead_stats('6914e294-2313-4694-93b5-b7736747feae');

  FOREACH expected IN ARRAY origins LOOP
    IF NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(stats.by_origin) o
      WHERE regexp_replace(btrim(o->>'origin'), '^#\s*-\s*', '') = regexp_replace(btrim(expected), '^#\s*-\s*', '')
    ) THEN
      RAISE EXCEPTION 'TESTE FALHOU: origem ausente: %', expected;
    END IF;
  END LOOP;

  IF stats.total_leads <> (
    SELECT COALESCE(sum((o->>'qtd')::bigint), 0)
    FROM jsonb_array_elements(stats.by_origin) o
  ) THEN
    RAISE EXCEPTION 'TESTE FALHOU: total % difere da soma das origens', stats.total_leads;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.smartops_forms f
    JOIN public.promotional_tables pt ON pt.id = f.promotional_table_id
    WHERE regexp_replace(btrim(f.name), '^#\s*-\s*', '') = '[WHTASATIVO] - BlackFriday 2026'
      AND pt.event_id = '6914e294-2313-4694-93b5-b7736747feae'
  ) THEN
    RAISE EXCEPTION 'TESTE FALHOU: WhatsApp ativo sem vínculo com a Black Friday 2026';
  END IF;

  RAISE NOTICE 'TESTE OK: 3 origens presentes, separadas e somando % leads únicos', stats.total_leads;
END
$t$;
