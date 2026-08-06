-- Com o refresh rodando em REPEATABLE READ, duas transações que gravam a MESMA
-- linha do cache falham com "could not serialize access due to concurrent update".
-- O job diário de histórico recalculava a partir do mês corrente (i=0), colidindo
-- com o job de 5 minutos — falha garantida uma vez por dia.
-- Agora o histórico cuida só dos meses FECHADOS; o mês corrente é do job de 5 min.
CREATE OR REPLACE FUNCTION public.painel_comercial_refresh_meses(p_meses integer DEFAULT 6)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  m date;
BEGIN
  FOR m IN
    SELECT (date_trunc('month', now()) - (i || ' month')::interval)::date
    FROM generate_series(1, greatest(coalesce(p_meses,6),1)) i   -- começa no mês anterior
  LOOP
    PERFORM public.painel_comercial_refresh_all(m);
  END LOOP;
END $function$;
