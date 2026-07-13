
CREATE TABLE IF NOT EXISTS public.stripe_payment_units (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id uuid REFERENCES public.lia_attendances(id) ON DELETE SET NULL,
  stripe_event_id text,
  stripe_checkout_id text,
  stripe_customer_id text,
  unit_index int NOT NULL DEFAULT 1,
  unit_total numeric,
  product_name text,
  paid_at timestamptz,
  id_dongle text,
  stripe_seller_id text,
  pre_ativacao_data date,
  pre_ativacao_status text,
  ativacao_data date,
  ativacao_status text,
  mensalidade_data date,
  mensalidade_status text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stripe_payment_units_checkout_unit_uk UNIQUE (stripe_checkout_id, unit_index)
);

CREATE INDEX IF NOT EXISTS stripe_payment_units_lead_idx ON public.stripe_payment_units (lead_id);
CREATE INDEX IF NOT EXISTS stripe_payment_units_paid_at_idx ON public.stripe_payment_units (paid_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.stripe_payment_units TO authenticated;
GRANT ALL ON public.stripe_payment_units TO service_role;

ALTER TABLE public.stripe_payment_units ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view payment units" ON public.stripe_payment_units FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert payment units" ON public.stripe_payment_units FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update payment units" ON public.stripe_payment_units FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete payment units" ON public.stripe_payment_units FOR DELETE TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.update_stripe_payment_units_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_stripe_payment_units_updated_at ON public.stripe_payment_units;
CREATE TRIGGER trg_stripe_payment_units_updated_at
BEFORE UPDATE ON public.stripe_payment_units
FOR EACH ROW EXECUTE FUNCTION public.update_stripe_payment_units_updated_at();

-- BACKFILL
WITH checkouts AS (
  SELECT
    l.id AS event_row_id,
    l.lead_id,
    l.event_timestamp,
    l.value_numeric,
    l.event_data->>'stripe_customer_id' AS stripe_customer_id,
    COALESCE(l.event_data->>'stripe_object_id', l.event_data->>'stripe_event_id', l.id::text) AS stripe_checkout_id,
    l.event_data
  FROM public.lead_activity_log l
  WHERE l.event_type = 'stripe_checkout_completed'
    AND l.source_channel = 'stripe'
),
qty_from_invoice AS (
  SELECT
    c.event_row_id,
    COALESCE(
      (
        SELECT SUM( COALESCE( (prod->>'qty')::int, 1) )
        FROM public.lead_activity_log inv,
             LATERAL jsonb_array_elements(COALESCE(inv.event_data->'products','[]'::jsonb)) AS prod
        WHERE inv.event_type = 'stripe_invoice_paid'
          AND inv.source_channel = 'stripe'
          AND inv.event_data->>'stripe_customer_id' = c.stripe_customer_id
          AND ABS(EXTRACT(EPOCH FROM (inv.event_timestamp - c.event_timestamp))) < 300
      ),
      1
    ) AS qty,
    (
      SELECT (prod->>'name')
      FROM public.lead_activity_log inv,
           LATERAL jsonb_array_elements(COALESCE(inv.event_data->'products','[]'::jsonb)) AS prod
      WHERE inv.event_type = 'stripe_invoice_paid'
        AND inv.source_channel = 'stripe'
        AND inv.event_data->>'stripe_customer_id' = c.stripe_customer_id
        AND ABS(EXTRACT(EPOCH FROM (inv.event_timestamp - c.event_timestamp))) < 300
      LIMIT 1
    ) AS product_name
  FROM checkouts c
),
expanded AS (
  SELECT c.*, q.qty, q.product_name, gs AS unit_index
  FROM checkouts c
  JOIN qty_from_invoice q ON q.event_row_id = c.event_row_id
  CROSS JOIN LATERAL generate_series(1, GREATEST(q.qty, 1)) gs
)
INSERT INTO public.stripe_payment_units (
  lead_id, stripe_event_id, stripe_checkout_id, stripe_customer_id,
  unit_index, unit_total, product_name, paid_at,
  stripe_seller_id,
  pre_ativacao_data, pre_ativacao_status,
  ativacao_data, ativacao_status,
  mensalidade_data, mensalidade_status
)
SELECT
  e.lead_id,
  e.event_data->>'stripe_event_id',
  e.stripe_checkout_id,
  e.stripe_customer_id,
  e.unit_index,
  CASE WHEN e.qty > 0 THEN ROUND((COALESCE(e.value_numeric,0) / e.qty)::numeric, 2) ELSE e.value_numeric END,
  COALESCE(e.product_name, e.event_data->>'description'),
  e.event_timestamp,
  CASE WHEN e.unit_index = 1 THEN la.stripe_seller_id ELSE NULL END,
  CASE WHEN e.unit_index = 1 THEN la.pre_ativacao_at::date ELSE NULL END,
  CASE WHEN e.unit_index = 1 THEN la.pre_ativacao_status ELSE NULL END,
  CASE WHEN e.unit_index = 1 THEN la.ativacao_at::date ELSE NULL END,
  CASE WHEN e.unit_index = 1 THEN la.ativacao_status ELSE NULL END,
  CASE WHEN e.unit_index = 1 THEN la.mensalidade_first_due::date ELSE NULL END,
  CASE WHEN e.unit_index = 1 THEN la.mensalidade_status ELSE NULL END
FROM expanded e
LEFT JOIN public.lia_attendances la ON la.id = e.lead_id
ON CONFLICT ON CONSTRAINT stripe_payment_units_checkout_unit_uk DO NOTHING;
