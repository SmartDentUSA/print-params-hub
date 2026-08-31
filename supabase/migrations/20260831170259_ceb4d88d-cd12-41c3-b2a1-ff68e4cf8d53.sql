ALTER TABLE public.smartops_forms
  ADD COLUMN IF NOT EXISTS forced_seller_team_member_id uuid REFERENCES public.team_members(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_smartops_forms_forced_seller
  ON public.smartops_forms (forced_seller_team_member_id)
  WHERE forced_seller_team_member_id IS NOT NULL;