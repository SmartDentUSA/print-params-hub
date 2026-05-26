CREATE TABLE IF NOT EXISTS public.rayshape_manual_owners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.lia_attendances(id) ON DELETE CASCADE,
  piperun_deal_id text,
  printer_date date NOT NULL,
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lead_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rayshape_manual_owners TO authenticated;
GRANT ALL ON public.rayshape_manual_owners TO service_role;

ALTER TABLE public.rayshape_manual_owners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rayshape_manual_owners_select_auth"
  ON public.rayshape_manual_owners FOR SELECT TO authenticated USING (true);

CREATE POLICY "rayshape_manual_owners_insert_admin"
  ON public.rayshape_manual_owners FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role(auth.uid()) = 'admin'::app_role);

CREATE POLICY "rayshape_manual_owners_update_admin"
  ON public.rayshape_manual_owners FOR UPDATE TO authenticated
  USING (public.get_user_role(auth.uid()) = 'admin'::app_role);

CREATE POLICY "rayshape_manual_owners_delete_admin"
  ON public.rayshape_manual_owners FOR DELETE TO authenticated
  USING (public.get_user_role(auth.uid()) = 'admin'::app_role);

ALTER PUBLICATION supabase_realtime ADD TABLE public.rayshape_manual_owners;

CREATE OR REPLACE FUNCTION public.fn_rayshape_owners()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
WITH deal_edge AS (
  SELECT
    d.id              AS deal_id,
    d.lead_id,
    d.closed_at,
    d.piperun_deal_id,
    d.owner_name,
    COALESCE(SUM((item->>'total')::numeric) FILTER (WHERE (item->>'nome') ILIKE '%Edge Mini%'), 0) AS printer_price
  FROM deals d
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(d.proposals, '[]'::jsonb)) prop
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(prop->'items', '[]'::jsonb)) item
  WHERE d.status = 'ganha'
    AND (d.is_deleted IS NULL OR d.is_deleted = false)
  GROUP BY d.id, d.lead_id, d.closed_at, d.piperun_deal_id, d.owner_name
  HAVING BOOL_OR((item->>'nome') ILIKE '%Edge Mini%')
),
printers_auto AS (
  SELECT DISTINCT ON (la.id)
    la.id                  AS lead_id,
    la.nome                AS lead_name,
    la.email               AS lead_email,
    la.telefone_normalized AS lead_phone,
    de.closed_at           AS printer_date,
    de.piperun_deal_id     AS printer_deal_id,
    de.owner_name          AS vendor,
    de.printer_price       AS printer_price,
    'auto'::text           AS source
  FROM deal_edge de
  JOIN lia_attendances la ON la.id = de.lead_id
  WHERE la.merged_into IS NULL
  ORDER BY la.id, de.closed_at ASC NULLS LAST
),
printers_manual AS (
  SELECT
    la.id                  AS lead_id,
    la.nome                AS lead_name,
    la.email               AS lead_email,
    la.telefone_normalized AS lead_phone,
    (m.printer_date::timestamp AT TIME ZONE 'America/Sao_Paulo') AS printer_date,
    m.piperun_deal_id      AS printer_deal_id,
    'manual'::text         AS vendor,
    0::numeric             AS printer_price,
    'manual'::text         AS source
  FROM rayshape_manual_owners m
  JOIN lia_attendances la ON la.id = m.lead_id
  WHERE la.merged_into IS NULL
    AND la.id NOT IN (SELECT lead_id FROM printers_auto)
),
printers AS (
  SELECT * FROM printers_auto
  UNION ALL
  SELECT * FROM printers_manual
),
post AS (
  SELECT
    p.lead_id,
    COUNT(DISTINCT d.id)::int                                  AS n_post,
    COALESCE(SUM((item->>'total')::numeric), 0)::numeric        AS total_post,
    MIN(EXTRACT(DAY FROM d.closed_at - p.printer_date))::int   AS first_repurchase_days
  FROM printers p
  LEFT JOIN deals d
    ON d.lead_id = p.lead_id
   AND d.status = 'ganha'
   AND (d.is_deleted IS NULL OR d.is_deleted = false)
   AND d.closed_at > p.printer_date
  LEFT JOIN LATERAL jsonb_array_elements(COALESCE(d.proposals, '[]'::jsonb)) prop ON TRUE
  LEFT JOIN LATERAL jsonb_array_elements(COALESCE(prop->'items', '[]'::jsonb)) item ON TRUE
  GROUP BY p.lead_id
)
SELECT COALESCE(jsonb_agg(row ORDER BY (row->>'days_since')::int DESC), '[]'::jsonb)
FROM (
  SELECT jsonb_build_object(
    'lead_id',               p.lead_id,
    'lead_name',             p.lead_name,
    'lead_email',            p.lead_email,
    'lead_phone',            p.lead_phone,
    'printer_date_iso',      (p.printer_date AT TIME ZONE 'America/Sao_Paulo')::date,
    'days_since',            EXTRACT(DAY FROM NOW() - p.printer_date)::int,
    'vendor',                COALESCE(p.vendor, ''),
    'printer_price',         COALESCE(p.printer_price, 0),
    'printer_deal_id',       p.printer_deal_id,
    'source',                p.source,
    'n_post',                COALESCE(po.n_post, 0),
    'total_post',            COALESCE(po.total_post, 0),
    'first_repurchase_days', po.first_repurchase_days,
    'category', CASE
      WHEN COALESCE(po.n_post,0) > 0                              THEN 'recomprou'
      WHEN EXTRACT(DAY FROM NOW() - p.printer_date)::int >= 180   THEN 'critico'
      WHEN EXTRACT(DAY FROM NOW() - p.printer_date)::int >=  90   THEN 'atencao'
      ELSE 'cedo'
    END
  ) AS row
  FROM printers p
  LEFT JOIN post po ON po.lead_id = p.lead_id
) s;
$function$;