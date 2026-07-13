ALTER TABLE public.lia_attendances
  ADD COLUMN IF NOT EXISTS stripe_seller_id text,
  ADD COLUMN IF NOT EXISTS stripe_first_payment_at timestamptz,
  ADD COLUMN IF NOT EXISTS pre_ativacao_at timestamptz,
  ADD COLUMN IF NOT EXISTS pre_ativacao_status text,
  ADD COLUMN IF NOT EXISTS ativacao_at timestamptz,
  ADD COLUMN IF NOT EXISTS ativacao_status text,
  ADD COLUMN IF NOT EXISTS mensalidade_first_due date,
  ADD COLUMN IF NOT EXISTS mensalidade_status text;

CREATE INDEX IF NOT EXISTS idx_lia_attendances_stripe_customer_id ON public.lia_attendances (stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lia_attendances_stripe_subscription_id ON public.lia_attendances (stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lia_attendances_stripe_seller_id ON public.lia_attendances (stripe_seller_id) WHERE stripe_seller_id IS NOT NULL;