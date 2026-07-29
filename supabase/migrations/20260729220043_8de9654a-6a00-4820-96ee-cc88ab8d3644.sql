CREATE TABLE IF NOT EXISTS public.sentinela_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_name text NOT NULL UNIQUE,
  label text,
  capture_groups boolean NOT NULL DEFAULT true,
  capture_direct boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.sentinela_instances TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sentinela_instances TO authenticated;
GRANT ALL ON public.sentinela_instances TO service_role;

ALTER TABLE public.sentinela_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read sentinela instances" ON public.sentinela_instances FOR SELECT USING (true);
CREATE POLICY "Admins manage sentinela instances" ON public.sentinela_instances FOR ALL USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

ALTER TABLE public.sentinela_group_messages ADD COLUMN IF NOT EXISTS is_group boolean NOT NULL DEFAULT true;

INSERT INTO public.sentinela_instances (instance_name, label, capture_groups, capture_direct, active)
VALUES ('Danilo-Henrique', 'Danilo Henrique', true, false, true)
ON CONFLICT (instance_name) DO NOTHING;