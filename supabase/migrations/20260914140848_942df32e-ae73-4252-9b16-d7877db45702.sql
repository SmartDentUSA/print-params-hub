ALTER TABLE public.smartops_forms
  ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES public.smartops_events(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS event_consultant_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS event_categories jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.lia_attendances
  ADD COLUMN IF NOT EXISTS event_id uuid,
  ADD COLUMN IF NOT EXISTS event_consultant_team_member_id uuid,
  ADD COLUMN IF NOT EXISTS event_interest_categories text[];

CREATE INDEX IF NOT EXISTS idx_smartops_forms_event_id ON public.smartops_forms(event_id);
CREATE INDEX IF NOT EXISTS idx_lia_attendances_event_id ON public.lia_attendances(event_id);