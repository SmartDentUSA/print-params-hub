ALTER TABLE public.stripe_payment_units
  ADD COLUMN IF NOT EXISTS numero_rms text,
  ADD COLUMN IF NOT EXISTS verificado boolean,
  ADD COLUMN IF NOT EXISTS hw_suficiente boolean,
  ADD COLUMN IF NOT EXISTS versoes_piratas boolean,
  ADD COLUMN IF NOT EXISTS ativo boolean;

CREATE INDEX IF NOT EXISTS idx_stripe_payment_units_numero_rms ON public.stripe_payment_units (numero_rms);