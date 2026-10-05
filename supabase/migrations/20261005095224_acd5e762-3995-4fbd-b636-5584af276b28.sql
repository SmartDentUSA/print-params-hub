ALTER TABLE public.smartops_courses
  ADD COLUMN IF NOT EXISTS waitlist_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS waitlist_message_template text;

CREATE TABLE public.smartops_turma_waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  turma_id uuid NOT NULL,
  course_id uuid,
  lead_id uuid,
  person_name text NOT NULL,
  phone text,
  email text,
  notes text,
  position integer,
  wa_sent_at timestamptz,
  wa_error text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.smartops_turma_waitlist TO authenticated;
GRANT ALL ON public.smartops_turma_waitlist TO service_role;
ALTER TABLE public.smartops_turma_waitlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated manage waitlist" ON public.smartops_turma_waitlist
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_turma_waitlist_turma ON public.smartops_turma_waitlist(turma_id, created_at);

CREATE OR REPLACE FUNCTION public.fn_waitlist_touch() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER trg_waitlist_touch BEFORE UPDATE ON public.smartops_turma_waitlist
  FOR EACH ROW EXECUTE FUNCTION public.fn_waitlist_touch();