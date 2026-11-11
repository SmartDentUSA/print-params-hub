CREATE TABLE public.kol_candidate_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL UNIQUE REFERENCES public.lia_attendances(id) ON DELETE CASCADE,
  registrant_team_member_id uuid,
  seller_team_member_id uuid,
  piperun_person_id bigint,
  piperun_deal_id bigint,
  note_posted_at timestamptz,
  portal_url text,
  wa_group_jid text,
  wa_group_name text,
  wa_group_error text,
  wa_message_id text,
  wa_message_sent_at timestamptz,
  wa_message_error text,
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.kol_candidate_registrations TO authenticated;
GRANT ALL ON public.kol_candidate_registrations TO service_role;
ALTER TABLE public.kol_candidate_registrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Internal staff can read KOL candidate registrations"
  ON public.kol_candidate_registrations FOR SELECT TO authenticated
  USING (public.fn_is_internal_staff(auth.uid()));
CREATE OR REPLACE FUNCTION public.fn_kol_candidate_touch()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER trg_kol_candidate_touch BEFORE UPDATE ON public.kol_candidate_registrations
  FOR EACH ROW EXECUTE FUNCTION public.fn_kol_candidate_touch();