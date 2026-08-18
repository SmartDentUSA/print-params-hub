CREATE TABLE IF NOT EXISTS public.li_reconciliation_state (
  id text PRIMARY KEY DEFAULT 'pedidos',
  last_data_modificacao timestamptz,
  last_run_at timestamptz,
  last_run_stats jsonb,
  updated_at timestamptz DEFAULT now()
);

GRANT ALL ON public.li_reconciliation_state TO service_role;

ALTER TABLE public.li_reconciliation_state ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'li_reconciliation_state'
      AND policyname = 'service_role_manages_li_reconciliation_state'
  ) THEN
    CREATE POLICY "service_role_manages_li_reconciliation_state"
      ON public.li_reconciliation_state FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;

INSERT INTO public.li_reconciliation_state (id, last_data_modificacao)
VALUES ('pedidos', NULL)
ON CONFLICT (id) DO NOTHING;