ALTER TABLE public.stripe_payment_units
  ADD COLUMN IF NOT EXISTS charge_kind text;

UPDATE public.stripe_payment_units u
SET charge_kind = k.kind
FROM (
  SELECT u2.id,
         COALESCE((
           SELECT CASE WHEN (e.event_data->>'stripe_subscription_id') IS NOT NULL
                        OR lower(COALESCE(e.event_data->>'mode','')) = 'subscription'
                       THEN 'mensalidade' ELSE 'ativacao' END
           FROM public.lead_activity_log e
           WHERE e.event_type = 'stripe_invoice_paid'
             AND e.lead_id = u2.lead_id
             AND abs(extract(epoch from (e.event_timestamp - u2.paid_at))) < 3600
           ORDER BY abs(extract(epoch from (e.event_timestamp - u2.paid_at)))
           LIMIT 1
         ), CASE WHEN u2.unit_total = 1199
                   AND COALESCE(u2.product_name,'') !~* '(ativa|implanta|setup)'
                 THEN 'mensalidade' ELSE 'ativacao' END) AS kind
  FROM public.stripe_payment_units u2
) k
WHERE u.id = k.id
  AND u.charge_kind IS DISTINCT FROM k.kind;