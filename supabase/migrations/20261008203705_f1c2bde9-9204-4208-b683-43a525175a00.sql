CREATE OR REPLACE FUNCTION public.fn_event_seller_crm_stats()
RETURNS TABLE(event_id uuid, by_seller jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  WITH ev AS (SELECT id, start_date::date AS d0 FROM public.smartops_events WHERE start_date IS NOT NULL),
  agg AS (
    SELECT ev.id AS event_id, NULLIF(btrim(dl.owner_name),'') AS seller,
      count(DISTINCT dl.id) FILTER (WHERE dl.pipeline_name = 'Funil de vendas'
        AND COALESCE(dl.piperun_created_at, dl.created_at)::date >= ev.d0) AS leads,
      count(DISTINCT dl.id) FILTER (WHERE dl.status = 'ganha' AND dl.closed_at::date >= ev.d0) AS ganhos,
      COALESCE(sum(dl.value) FILTER (WHERE dl.status = 'ganha' AND dl.closed_at::date >= ev.d0),0) AS valor
    FROM ev JOIN public.deals dl
      ON COALESCE(dl.piperun_created_at, dl.created_at)::date >= ev.d0 OR dl.closed_at::date >= ev.d0
    WHERE NULLIF(btrim(dl.owner_name),'') IS NOT NULL AND dl.owner_name !~ '^\d+$'
    GROUP BY ev.id, NULLIF(btrim(dl.owner_name),'')
  )
  SELECT event_id, jsonb_agg(jsonb_build_object('seller',seller,'leads',leads,'ganhos',ganhos,'valor',valor) ORDER BY valor DESC, leads DESC)
  FROM agg WHERE leads > 0 OR ganhos > 0 GROUP BY event_id;
$$;
REVOKE ALL ON FUNCTION public.fn_event_seller_crm_stats() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.fn_event_seller_crm_stats() TO authenticated, service_role;