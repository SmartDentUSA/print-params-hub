ALTER TABLE public.kol_contracts ADD COLUMN IF NOT EXISTS seller_team_member_id uuid, ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;
ALTER TABLE public.lia_attendances ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.kol_program_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kol_program_settings TO authenticated;
GRANT ALL ON public.kol_program_settings TO service_role;
ALTER TABLE public.kol_program_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage KOL settings" ON public.kol_program_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.kol_program_settings(key,value,description) VALUES
 ('group_always_members','["5519992612348"]','Celulares incluídos em todo grupo de WhatsApp de KOL'),
 ('group_creation_dry_run','false','Quando true, nenhum grupo real é criado (simulação)')
ON CONFLICT (key) DO NOTHING;

UPDATE public.kol_contracts SET is_test = true WHERE number LIKE 'KOL-2026-TEST%';
UPDATE public.lia_attendances SET is_test = true
 WHERE (nome ILIKE '[TESTE KOL]%' OR prof_display_name ILIKE '[TESTE KOL]%'
    OR id IN (SELECT lead_id FROM public.kol_contracts WHERE is_test));