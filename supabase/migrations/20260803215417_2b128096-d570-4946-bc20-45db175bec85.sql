CREATE TABLE IF NOT EXISTS public.training_drive_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  turma_id uuid NOT NULL REFERENCES public.smartops_course_turmas(id) ON DELETE CASCADE,
  enrollment_id uuid NULL REFERENCES public.smartops_course_enrollments(id) ON DELETE SET NULL,
  companion_id uuid NULL REFERENCES public.smartops_enrollment_companions(id) ON DELETE SET NULL,
  participant_name_snapshot text NULL,
  participant_type text NULL,
  destination_key text NOT NULL,
  drive_folder_id text NOT NULL,
  drive_file_id text NULL,
  drive_web_view_link text NULL,
  original_filename text NOT NULL,
  generated_filename text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL,
  width integer NULL,
  height integer NULL,
  orientation text NULL,
  training_day integer NULL,
  training_date date NULL,
  category text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  error_message text NULL,
  resumable_session_uri text NULL,
  bytes_uploaded bigint NOT NULL DEFAULT 0,
  exception_reason text NULL,
  uploaded_by uuid NOT NULL,
  uploaded_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_training_drive_media_turma ON public.training_drive_media(turma_id);
CREATE INDEX IF NOT EXISTS idx_training_drive_media_enrollment ON public.training_drive_media(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_training_drive_media_status ON public.training_drive_media(status);

CREATE OR REPLACE FUNCTION public.can_manage_training_media(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id AND ur.role = 'admin'::app_role
  ) OR EXISTS (
    SELECT 1
    FROM public.team_members tm
    JOIN auth.users u ON lower(u.email) = lower(tm.email)
    WHERE u.id = _user_id AND tm.email IS NOT NULL
  )
$$;

GRANT SELECT ON public.training_drive_media TO authenticated;
GRANT ALL ON public.training_drive_media TO service_role;

ALTER TABLE public.training_drive_media ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "training media readable by staff" ON public.training_drive_media;
CREATE POLICY "training media readable by staff"
ON public.training_drive_media
FOR SELECT
TO authenticated
USING (public.can_manage_training_media(auth.uid()));

CREATE OR REPLACE FUNCTION public.fn_training_drive_media_touch()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_training_drive_media_touch ON public.training_drive_media;
CREATE TRIGGER trg_training_drive_media_touch
BEFORE UPDATE ON public.training_drive_media
FOR EACH ROW EXECUTE FUNCTION public.fn_training_drive_media_touch();