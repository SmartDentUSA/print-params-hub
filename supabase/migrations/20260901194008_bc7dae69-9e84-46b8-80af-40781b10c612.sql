CREATE TABLE IF NOT EXISTS public.live_group_automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'Divulgação de Lives',
  enabled boolean NOT NULL DEFAULT false,
  group_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  course_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  promo_enabled boolean NOT NULL DEFAULT true,
  promo_days_before integer NOT NULL DEFAULT 1,
  promo_time time NOT NULL DEFAULT '08:30',
  promo_template text,
  live_enabled boolean NOT NULL DEFAULT true,
  live_minutes_before integer NOT NULL DEFAULT 5,
  live_template text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.live_group_automations IS 'Construtor de automação: divulgação de lives (D-1 08:30) e lembrete ao vivo (5 min antes) em grupos WA selecionados.';

CREATE TABLE IF NOT EXISTS public.live_group_blast_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id uuid NOT NULL REFERENCES public.live_group_automations(id) ON DELETE CASCADE,
  turma_id uuid NOT NULL,
  kind text NOT NULL,
  campaign_id uuid,
  groups_count integer NOT NULL DEFAULT 0,
  sent_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT live_group_blast_log_kind_chk CHECK (kind IN ('promo','live')),
  CONSTRAINT live_group_blast_log_uniq UNIQUE (automation_id, turma_id, kind)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.live_group_automations TO authenticated;
GRANT ALL ON public.live_group_automations TO service_role;
GRANT SELECT ON public.live_group_blast_log TO authenticated;
GRANT ALL ON public.live_group_blast_log TO service_role;

ALTER TABLE public.live_group_automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_group_blast_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "team_manage_live_group_automations" ON public.live_group_automations
  FOR ALL TO authenticated USING (public.fn_is_team_member()) WITH CHECK (public.fn_is_team_member());

CREATE POLICY "team_read_live_group_blast_log" ON public.live_group_blast_log
  FOR SELECT TO authenticated USING (public.fn_is_team_member());

CREATE TRIGGER trg_live_group_automations_updated_at
  BEFORE UPDATE ON public.live_group_automations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();