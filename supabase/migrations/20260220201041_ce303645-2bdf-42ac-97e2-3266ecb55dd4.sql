
CREATE TABLE IF NOT EXISTS public.drive_kb_sync_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drive_file_id text NOT NULL UNIQUE,
  file_name     text NOT NULL,
  mime_type     text,
  folder_name   text,
  category      text NOT NULL DEFAULT 'geral',
  source_label  text,
  kb_text_id    uuid REFERENCES public.company_kb_texts(id) ON DELETE SET NULL,
  status        text NOT NULL DEFAULT 'pending',
  error_msg     text,
  processed_at  timestamp with time zone,
  modified_time text,
  created_at    timestamp with time zone DEFAULT now()
);

ALTER TABLE public.drive_kb_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage drive sync log"
  ON public.drive_kb_sync_log FOR ALL
  USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
