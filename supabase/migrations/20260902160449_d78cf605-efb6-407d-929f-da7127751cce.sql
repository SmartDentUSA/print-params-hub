ALTER TABLE public.smartops_events
  ADD COLUMN IF NOT EXISTS days_count integer,
  ADD COLUMN IF NOT EXISTS drive_folder_id text,
  ADD COLUMN IF NOT EXISTS drive_folder_url text,
  ADD COLUMN IF NOT EXISTS drive_folder_name text,
  ADD COLUMN IF NOT EXISTS drive_folder_created_at timestamptz,
  ADD COLUMN IF NOT EXISTS drive_subfolders jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS drive_destinations jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS drive_descricao_file_id text,
  ADD COLUMN IF NOT EXISTS drive_docx_file_id text,
  ADD COLUMN IF NOT EXISTS drive_json_file_id text;

CREATE TABLE IF NOT EXISTS public.event_drive_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.smartops_events(id) ON DELETE CASCADE,
  destination_key text NOT NULL,
  destination_label text,
  category text,
  event_day integer,
  event_date date,
  speaker_name text,
  drive_folder_id text NOT NULL,
  drive_file_id text,
  drive_web_view_link text,
  original_filename text NOT NULL,
  generated_filename text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL,
  width integer,
  height integer,
  orientation text,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  bytes_uploaded bigint NOT NULL DEFAULT 0,
  resumable_session_uri text,
  transcript text,
  copy_status text NOT NULL DEFAULT 'pending',
  copy_error text,
  copy_caption text,
  copy_variations jsonb NOT NULL DEFAULT '[]'::jsonb,
  copy_hashtags text[] NOT NULL DEFAULT '{}'::text[],
  copy_generated_at timestamptz,
  uploaded_by uuid NOT NULL,
  uploaded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT event_drive_media_drive_file_unique UNIQUE (drive_file_id)
);

CREATE INDEX IF NOT EXISTS event_drive_media_event_idx ON public.event_drive_media (event_id, destination_key);
CREATE INDEX IF NOT EXISTS event_drive_media_copy_idx ON public.event_drive_media (copy_status) WHERE status = 'completed';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_drive_media TO authenticated;
GRANT ALL ON public.event_drive_media TO service_role;

ALTER TABLE public.event_drive_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Equipe ativa le midias de eventos"
  ON public.event_drive_media FOR SELECT TO authenticated
  USING (public.can_manage_training_media(auth.uid()));

CREATE POLICY "Equipe ativa envia midias de eventos"
  ON public.event_drive_media FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_training_media(auth.uid()) AND uploaded_by = auth.uid());

CREATE POLICY "Equipe ativa atualiza midias de eventos"
  ON public.event_drive_media FOR UPDATE TO authenticated
  USING (public.can_manage_training_media(auth.uid()) AND (uploaded_by = auth.uid() OR public.has_role(auth.uid(), 'admin')))
  WITH CHECK (public.can_manage_training_media(auth.uid()));

CREATE POLICY "Admin remove midias de eventos"
  ON public.event_drive_media FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER event_drive_media_touch
  BEFORE UPDATE ON public.event_drive_media
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.fn_agenda_event_drive_folders()
RETURNS TABLE (
  event_id uuid,
  name text,
  start_date date,
  end_date date,
  location text,
  country text,
  folder_id text,
  folder_url text,
  destinations jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.id, e.name, e.start_date, e.end_date, e.location, e.country,
         e.drive_folder_id, e.drive_folder_url, e.drive_destinations
  FROM public.smartops_events e
  WHERE public.can_manage_training_media(auth.uid())
  ORDER BY e.start_date DESC NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION public.fn_agenda_event_drive_folders() TO authenticated;