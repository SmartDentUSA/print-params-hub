CREATE OR REPLACE FUNCTION public.list_lead_origin_conversions()
RETURNS TABLE(origin_key text, won_leads bigint, won_deals bigint, revenue numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
WITH leads AS (
  SELECT la.id, la.created_at,
    COALESCE(NULLIF(la.meta_form_id,''), NULLIF(la.platform_form_id,''), NULLIF(la.form_name,''), NULLIF(la.origem_primeiro_contato,'')) AS k,
    NULLIF(la.form_name,'') AS fname
  FROM public.lia_attendances la
  WHERE la.merged_into IS NULL
),
won AS (
  SELECT d.id, d.lead_id, d.origin_name, COALESCE(d.value,0) AS value,
         COALESCE(d.closed_at, d.piperun_updated_at) AS won_at, d.piperun_created_at
  FROM public.deals d WHERE d.status = 'ganha'
),
pairs AS (
  SELECT l.k, w.id AS deal_id, w.lead_id, w.value
  FROM leads l JOIN won w ON w.lead_id = l.id
  WHERE l.k IS NOT NULL AND (w.won_at IS NULL OR w.won_at >= l.created_at)
  UNION
  SELECT w.origin_name, w.id, w.lead_id, w.value
  FROM won w
  WHERE w.origin_name IS NOT NULL AND w.origin_name <> ''
    AND (w.won_at IS NULL OR w.piperun_created_at IS NULL OR w.won_at >= w.piperun_created_at)
)
SELECT p.k, count(DISTINCT p.lead_id)::bigint, count(DISTINCT p.deal_id)::bigint,
       COALESCE(sum(DISTINCT_v.value),0)
FROM pairs p
CROSS JOIN LATERAL (SELECT p.value) DISTINCT_v
WHERE public.has_role(auth.uid(), 'admin')
GROUP BY p.k;
$$;
REVOKE ALL ON FUNCTION public.list_lead_origin_conversions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_lead_origin_conversions() TO authenticated;